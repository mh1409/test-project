import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient, isRetryableTxError, type Prisma, type TransactionClient } from '@souq/database';
import type { Metrics } from '@souq/observability';
import { ENV, LOGGER, METRICS, type Env, type Logger } from '../config/config.module';

export type Tx = TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(ENV) env: Env,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(METRICS) private readonly metrics: Metrics,
  ) {
    super({
      datasourceUrl: env.DATABASE_URL,
      log: env.NODE_ENV === 'development' ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }] : [{ emit: 'event', level: 'error' }],
      transactionOptions: { maxWait: 5000, timeout: 20000 },
    });
  }

  async onModuleInit(): Promise<void> {
    // Query latency metrics via the client extension-less $on('query') is not available with
    // event-emitting disabled, so we use middleware-style timing through $extends.
    await this.$connect();
    this.logger.info('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.info('Database disconnected');
  }

  /** Time a query and record it in metrics. */
  async timed<T>(model: string, action: string, fn: () => Promise<T>): Promise<T> {
    const end = this.metrics.dbQueryDuration.startTimer({ model, action });
    try {
      return await fn();
    } finally {
      end();
    }
  }

  /**
   * Run an interactive transaction with retry on serialization failures/deadlocks.
   * Use SERIALIZABLE only for hot financial paths; default READ COMMITTED + explicit row locks.
   */
  async transaction<T>(
    fn: (tx: Tx) => Promise<T>,
    options: { isolationLevel?: Prisma.TransactionIsolationLevel; maxRetries?: number; timeout?: number } = {},
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    let attempt = 0;
    for (;;) {
      try {
        return await this.$transaction(fn, {
          isolationLevel: options.isolationLevel,
          timeout: options.timeout ?? 20000,
          maxWait: 5000,
        });
      } catch (err) {
        attempt += 1;
        if (attempt > maxRetries || !isRetryableTxError(err)) throw err;
        const backoff = 25 * 2 ** attempt + Math.floor(Math.random() * 25);
        this.logger.warn({ attempt, backoff }, 'Retrying transaction after serialization failure');
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  /** Postgres advisory lock scoped to the transaction (released on commit/rollback). */
  async advisoryLock(tx: Tx, key: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
