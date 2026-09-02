import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, LOGGER, type Env, type Logger } from '../config/config.module';

/**
 * Redis connection manager. Redis is an optional dependency: when it is down the
 * application degrades (in-memory cache, DB-backed locks, in-process queue) instead of failing.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private available = false;
  private readonly enabled: boolean;

  constructor(@Inject(ENV) private readonly env: Env, @Inject(LOGGER) private readonly logger: Logger) {
    this.enabled = env.NODE_ENV !== 'test' || process.env.REDIS_IN_TESTS === 'true';
    if (this.enabled) this.connect();
  }

  private connect(): void {
    this.client = new Redis(this.env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      retryStrategy: (times) => Math.min(times * 500, 10_000),
    });
    this.client.on('ready', () => {
      this.available = true;
      this.logger.info('Redis connected');
    });
    this.client.on('end', () => {
      this.available = false;
    });
    this.client.on('error', (err) => {
      if (this.available || this.env.REDIS_REQUIRED) this.logger.warn({ err: err.message }, 'Redis error');
      this.available = false;
    });
  }

  get isAvailable(): boolean {
    return this.available && this.client?.status === 'ready';
  }

  /** Returns the client when available, otherwise null so callers can degrade. */
  get(): Redis | null {
    return this.isAvailable ? this.client : null;
  }

  /** Dedicated duplicate connection (for BullMQ, socket adapters, blocking commands). */
  duplicate(): Redis | null {
    if (!this.client || !this.enabled) return null;
    return this.client.duplicate({ maxRetriesPerRequest: null, enableOfflineQueue: true });
  }

  getSubscriber(): Redis | null {
    if (!this.client || !this.enabled) return null;
    if (!this.subscriber) this.subscriber = this.client.duplicate();
    return this.subscriber;
  }

  async ping(): Promise<boolean> {
    try {
      const c = this.get();
      if (!c) return false;
      return (await c.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.client?.quit(), this.subscriber?.quit()]);
  }
}
