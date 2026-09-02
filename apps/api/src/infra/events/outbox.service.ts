import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@souq/database';
import type { Metrics } from '@souq/observability';
import { requestContext } from '@souq/observability';
import type { DomainEvent, DomainEventName } from '@souq/types';
import { LOGGER, METRICS, type Logger } from '../config/config.module';
import { PrismaService, type Tx } from '../prisma/prisma.service';
import { EVENT_BUS, type EventBus } from './event-bus';

/**
 * Transactional outbox: `emit` writes the event in the SAME database transaction as the
 * business change; the relay publishes pending rows to the bus with retries/backoff.
 * Guarantees at-least-once delivery without dual-write inconsistency.
 */
@Injectable()
export class OutboxService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(METRICS) private readonly metrics: Metrics,
  ) {}

  async emit(tx: Tx, name: DomainEventName, aggregateType: string, aggregateId: string, payload: Record<string, unknown>): Promise<string> {
    const id = randomUUID();
    await tx.outboxEvent.create({
      data: {
        id,
        name,
        aggregateType,
        aggregateId,
        payload: payload as Prisma.InputJsonValue,
        correlationId: requestContext.get()?.correlationId ?? null,
      },
    });
    this.metrics.businessEvents.inc({ event: name });
    return id;
  }

  /** Publish a batch of pending events. Called by the worker relay loop; safe to run concurrently (SKIP LOCKED). */
  async relay(batchSize = 100): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM outbox_events WHERE status = 'PENDING' AND "nextAttemptAt" <= now()
      ORDER BY "createdAt" LIMIT ${batchSize} FOR UPDATE SKIP LOCKED`;
    if (rows.length === 0) return 0;
    const ids = rows.map((r) => r.id);
    const events = await this.prisma.outboxEvent.findMany({ where: { id: { in: ids } } });
    let published = 0;
    for (const row of events) {
      const event: DomainEvent = {
        id: row.id,
        name: row.name as DomainEventName,
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        payload: row.payload as Record<string, unknown>,
        occurredAt: row.createdAt.toISOString(),
        correlationId: row.correlationId ?? undefined,
        version: row.version,
      };
      try {
        await this.bus.publish(event);
        await this.prisma.outboxEvent.update({ where: { id: row.id }, data: { status: 'PUBLISHED', publishedAt: new Date(), attempts: { increment: 1 } } });
        published += 1;
      } catch (err) {
        const attempts = row.attempts + 1;
        const backoffMs = Math.min(2 ** attempts * 1000, 10 * 60_000);
        await this.prisma.outboxEvent.update({
          where: { id: row.id },
          data: { attempts, lastError: String((err as Error).message).slice(0, 1000), nextAttemptAt: new Date(Date.now() + backoffMs), status: attempts >= 20 ? 'FAILED' : 'PENDING' },
        });
        this.logger.warn({ err: (err as Error).message, event: row.name, attempts }, 'Outbox publish failed');
      }
    }
    const pending = await this.prisma.outboxEvent.count({ where: { status: 'PENDING' } });
    this.metrics.outboxPending.set(pending);
    return published;
  }

  async purgePublished(olderThanDays = 7): Promise<number> {
    const res = await this.prisma.outboxEvent.deleteMany({ where: { status: 'PUBLISHED', publishedAt: { lt: new Date(Date.now() - olderThanDays * 86400_000) } } });
    return res.count;
  }
}
