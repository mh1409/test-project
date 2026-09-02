import { Inject, Injectable } from '@nestjs/common';
import { FEATURE_FLAG_KEYS, featureDefaults, type FeatureFlagKey } from '@souq/config';
import { createHash } from 'node:crypto';
import { CacheService } from '../cache/cache.service';
import { ENV, type Env } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';

interface FlagRules {
  rolloutPercent?: number;
  allowUserIds?: string[];
  allowRoles?: string[];
}
interface FlagRecord {
  key: string;
  enabled: boolean;
  rules: FlagRules | null;
}

/** Feature flags: env defaults overridden by DB records (managed in admin), cached 30s. */
@Injectable()
export class FeatureFlagService {
  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService, @Inject(ENV) private readonly env: Env) {}

  async all(): Promise<Record<FeatureFlagKey, boolean>> {
    const defaults = featureDefaults(this.env);
    const records = await this.records();
    const out = { ...defaults };
    for (const r of records) if ((FEATURE_FLAG_KEYS as readonly string[]).includes(r.key)) out[r.key as FeatureFlagKey] = r.enabled;
    return out;
  }

  async isEnabled(key: FeatureFlagKey, ctx: { userId?: string; roles?: string[] } = {}): Promise<boolean> {
    const records = await this.records();
    const record = records.find((r) => r.key === key);
    if (!record) return featureDefaults(this.env)[key];
    if (!record.enabled) return false;
    const rules = record.rules;
    if (!rules) return true;
    if (rules.allowUserIds?.length && ctx.userId && rules.allowUserIds.includes(ctx.userId)) return true;
    if (rules.allowRoles?.length && ctx.roles?.some((r) => rules.allowRoles?.includes(r))) return true;
    if (typeof rules.rolloutPercent === 'number') {
      if (!ctx.userId) return rules.rolloutPercent >= 100;
      const bucket = parseInt(createHash('sha1').update(`${key}:${ctx.userId}`).digest('hex').slice(0, 8), 16) % 100;
      return bucket < rules.rolloutPercent;
    }
    if (rules.allowUserIds?.length || rules.allowRoles?.length) return false;
    return true;
  }

  async invalidate(): Promise<void> {
    await this.cache.del('feature-flags');
  }

  private async records(): Promise<FlagRecord[]> {
    return this.cache.remember('feature-flags', 30, async () => {
      const rows = await this.prisma.featureFlag.findMany();
      return rows.map((r) => ({ key: r.key, enabled: r.enabled, rules: (r.rules as FlagRules | null) ?? null }));
    });
  }
}
