import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@souq/shared';
import type { Response } from 'express';
import { ENV, type Env } from '../../infra/config/config.module';
import { RedisService } from '../../infra/redis/redis.service';
import { RATE_LIMIT_KEY, type RateLimitOptions } from '../decorators';
import type { AppRequest } from '../types/request';

/** Default global policy applied to every route unless overridden. */
export const DEFAULT_POLICY: RateLimitOptions = { name: 'global', limit: 300, windowSeconds: 60, keyBy: 'ip' };

// Sliding window using Redis sorted set; in-memory fixed window fallback (per instance).
const INCR_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, ARGV[4])
  redis.call('PEXPIRE', key, window)
  return {count + 1, 0}
end
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local reset = window - (now - tonumber(oldest[2]))
return {count, reset}
`;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly memory = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly reflector: Reflector, private readonly redis: RedisService, @Inject(ENV) private readonly env: Env) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.env.RATE_LIMIT_ENABLED || context.getType() !== 'http') return true;
    const policy = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]) ?? DEFAULT_POLICY;
    const req = context.switchToHttp().getRequest<AppRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const key = this.buildKey(policy, req);
    const { count, resetMs } = await this.hit(key, policy);
    res.setHeader('X-RateLimit-Limit', policy.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, policy.limit - count));
    if (count > policy.limit) {
      res.setHeader('Retry-After', Math.ceil(resetMs / 1000));
      throw new AppError('RATE_LIMITED', 'Too many requests', { policy: policy.name, retryAfterSeconds: Math.ceil(resetMs / 1000) });
    }
    return true;
  }

  private buildKey(policy: RateLimitOptions, req: AppRequest): string {
    const parts = [policy.name];
    const keyBy = policy.keyBy ?? 'ip';
    if (keyBy.includes('ip')) parts.push(req.ip ?? 'unknown');
    if (keyBy.includes('user')) parts.push(req.user?.id ?? 'anon');
    return `souq:rl:${parts.join(':')}`;
  }

  private async hit(key: string, policy: RateLimitOptions): Promise<{ count: number; resetMs: number }> {
    const windowMs = policy.windowSeconds * 1000;
    const client = this.redis.get();
    if (client) {
      try {
        const now = Date.now();
        const result = (await client.eval(INCR_SCRIPT, 1, key, now, windowMs, policy.limit, `${now}-${Math.random()}`)) as [number, number];
        const count = result[0];
        return { count: count >= policy.limit && result[1] > 0 ? policy.limit + 1 : count, resetMs: result[1] || windowMs };
      } catch {
        /* fall back */
      }
    }
    const now = Date.now();
    const entry = this.memory.get(key);
    if (!entry || entry.resetAt < now) {
      this.memory.set(key, { count: 1, resetAt: now + windowMs });
      if (this.memory.size > 50_000) this.memory.clear();
      return { count: 1, resetMs: windowMs };
    }
    entry.count += 1;
    return { count: entry.count, resetMs: entry.resetAt - now };
  }
}
