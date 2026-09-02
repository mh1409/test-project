import { Inject, Injectable } from '@nestjs/common';
import type { Metrics } from '@souq/observability';
import { METRICS } from '../config/config.module';
import { RedisService } from '../redis/redis.service';

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

/**
 * Cache with Redis primary and bounded in-memory fallback. Keys are namespaced and
 * tag-based invalidation is supported through tag sets (redis) / tag index (memory).
 */
@Injectable()
export class CacheService {
  private readonly memory = new Map<string, MemoryEntry>();
  private readonly memoryTags = new Map<string, Set<string>>();
  private readonly maxMemoryEntries = 5000;
  private readonly prefix = 'souq:cache:';

  constructor(private readonly redis: RedisService, @Inject(METRICS) private readonly metrics: Metrics) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.getRaw(key);
    if (raw == null) {
      this.metrics.cacheOps.inc({ result: 'miss' });
      return null;
    }
    this.metrics.cacheOps.inc({ result: 'hit' });
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number, tags: string[] = []): Promise<void> {
    const raw = JSON.stringify(value);
    const client = this.redis.get();
    if (client) {
      try {
        const pipeline = client.multi();
        pipeline.set(this.prefix + key, raw, 'EX', ttlSeconds);
        for (const tag of tags) {
          pipeline.sadd(this.prefix + 'tag:' + tag, key);
          pipeline.expire(this.prefix + 'tag:' + tag, Math.max(ttlSeconds, 3600));
        }
        await pipeline.exec();
        return;
      } catch {
        /* fall through to memory */
      }
    }
    this.setMemory(key, raw, ttlSeconds, tags);
  }

  async del(...keys: string[]): Promise<void> {
    const client = this.redis.get();
    if (client && keys.length) {
      try {
        await client.del(...keys.map((k) => this.prefix + k));
      } catch {
        /* ignore */
      }
    }
    for (const k of keys) this.memory.delete(k);
  }

  /** Invalidate every key tagged with any of the given tags. */
  async invalidateTags(...tags: string[]): Promise<void> {
    const client = this.redis.get();
    for (const tag of tags) {
      if (client) {
        try {
          const tagKey = this.prefix + 'tag:' + tag;
          const keys = await client.smembers(tagKey);
          if (keys.length) await client.del(...keys.map((k) => this.prefix + k), tagKey);
          else await client.del(tagKey);
        } catch {
          /* ignore */
        }
      }
      const memKeys = this.memoryTags.get(tag);
      if (memKeys) {
        for (const k of memKeys) this.memory.delete(k);
        this.memoryTags.delete(tag);
      }
    }
  }

  /** Read-through helper. */
  async remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>, tags: string[] = []): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await loader();
    if (value !== undefined && value !== null) await this.set(key, value, ttlSeconds, tags);
    return value;
  }

  private async getRaw(key: string): Promise<string | null> {
    const client = this.redis.get();
    if (client) {
      try {
        return await client.get(this.prefix + key);
      } catch {
        /* fall through */
      }
    }
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  private setMemory(key: string, value: string, ttlSeconds: number, tags: string[]): void {
    if (this.memory.size >= this.maxMemoryEntries) {
      const first = this.memory.keys().next().value;
      if (first !== undefined) this.memory.delete(first);
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    for (const tag of tags) {
      if (!this.memoryTags.has(tag)) this.memoryTags.set(tag, new Set());
      this.memoryTags.get(tag)?.add(key);
    }
  }
}
