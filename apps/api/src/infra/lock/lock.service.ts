import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConflictError } from '@souq/shared';
import { LOGGER, type Logger } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

export interface LockHandle {
  key: string;
  release(): Promise<void>;
}

/**
 * Distributed mutex. Redis SET NX PX when available; falls back to a Postgres
 * session-level advisory lock held on a dedicated connection-free path (pg_try_advisory_lock
 * inside a short transaction is not possible across calls), so the fallback uses
 * pg_advisory_lock in a single transaction-scoped helper `withLock`.
 */
@Injectable()
export class LockService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Execute `fn` while holding a lock on `key`. Waits up to `waitMs` for acquisition.
   * When Redis is unavailable, the whole function runs inside a Postgres transaction
   * holding an advisory xact lock, which gives the same mutual exclusion guarantee.
   */
  async withLock<T>(key: string, fn: () => Promise<T>, options: { ttlMs?: number; waitMs?: number } = {}): Promise<T> {
    const ttlMs = options.ttlMs ?? 10_000;
    const waitMs = options.waitMs ?? 5_000;
    const client = this.redis.get();
    if (client) {
      const token = randomUUID();
      const redisKey = `souq:lock:${key}`;
      const deadline = Date.now() + waitMs;
      for (;;) {
        let acquired = false;
        try {
          acquired = (await client.set(redisKey, token, 'PX', ttlMs, 'NX')) === 'OK';
        } catch {
          this.logger.warn({ key }, 'Redis lock failed; falling back to advisory lock');
          return this.withAdvisoryLock(key, fn);
        }
        if (acquired) break;
        if (Date.now() > deadline) throw new ConflictError('Resource is busy, please retry');
        await new Promise((r) => setTimeout(r, 50 + Math.random() * 50));
      }
      try {
        return await fn();
      } finally {
        try {
          await client.eval(RELEASE_SCRIPT, 1, redisKey, token);
        } catch {
          /* lock expires by TTL */
        }
      }
    }
    return this.withAdvisoryLock(key, fn);
  }

  private async withAdvisoryLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'lock:' + key}))`;
        return fn();
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  }
}
