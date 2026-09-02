import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue, type JobsOptions } from 'bullmq';
import type { Metrics } from '@souq/observability';
import { ENV, LOGGER, METRICS, type Env, type Logger } from '../config/config.module';
import { RedisService } from '../redis/redis.service';
import { JOB_QUEUE, QUEUES, type JobName, type JobPayloads, type QueueName } from './queue.constants';

export type LocalJobHandler = <N extends JobName>(name: N, payload: JobPayloads[N]) => Promise<void>;

/**
 * Job producer. Uses BullMQ when Redis is available. Without Redis (dev/test), jobs are
 * executed in-process on a best-effort basis through a registered local handler so
 * flows still complete (emails logged, search indexed) — never silently dropped.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<QueueName, Queue>();
  private localHandler: LocalJobHandler | null = null;
  readonly pendingLocal: { name: JobName; payload: unknown }[] = [];

  constructor(
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(METRICS) private readonly metrics: Metrics,
  ) {}

  /** Worker registers itself here for the in-process fallback. */
  setLocalHandler(handler: LocalJobHandler): void {
    this.localHandler = handler;
  }

  get usingRedis(): boolean {
    return this.redis.isAvailable && this.env.NODE_ENV !== 'test';
  }

  async enqueue<N extends JobName>(name: N, payload: JobPayloads[N], opts: JobsOptions = {}): Promise<void> {
    const queueName = JOB_QUEUE[name];
    if (this.usingRedis) {
      try {
        const q = this.queue(queueName);
        await q.add(name, payload, {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: false, // kept for dead-letter inspection
          ...opts,
        });
        this.metrics.queueJobs.inc({ queue: queueName, status: 'enqueued' });
        return;
      } catch (err) {
        this.logger.warn({ err: (err as Error).message, name }, 'Enqueue failed; running job locally');
      }
    }
    if (this.localHandler && !opts.delay) {
      // fire-and-forget in-process execution
      const handler = this.localHandler;
      setImmediate(() => {
        handler(name, payload).catch((err) => this.logger.error({ err, name }, 'Local job failed'));
      });
    } else {
      this.pendingLocal.push({ name, payload });
      if (this.pendingLocal.length > 10_000) this.pendingLocal.shift();
    }
  }

  /** Schedule/upsert a repeatable job (cron). Only effective with Redis; the worker also runs a timer fallback. */
  async scheduleRepeatable<N extends JobName>(name: N, payload: JobPayloads[N], pattern: string): Promise<void> {
    if (!this.usingRedis) return;
    const q = this.queue(JOB_QUEUE[name]);
    await q.upsertJobScheduler(`sched:${name}`, { pattern }, { name, data: payload, opts: { removeOnComplete: { count: 50 }, attempts: 3 } });
  }

  queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      const connection = this.redis.duplicate();
      if (!connection) throw new Error('Redis unavailable');
      q = new Queue(name, { connection, prefix: 'souq:bull' });
      this.queues.set(name, q);
    }
    return q;
  }

  async stats(): Promise<Record<string, Record<string, number>>> {
    const out: Record<string, Record<string, number>> = {};
    if (!this.usingRedis) return out;
    for (const name of Object.values(QUEUES)) {
      try {
        const counts = await this.queue(name).getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
        out[name] = counts;
        for (const [state, n] of Object.entries(counts)) this.metrics.queueSize.set({ queue: name, state }, n);
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([...this.queues.values()].map((q) => q.close()));
  }
}
