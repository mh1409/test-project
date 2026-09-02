import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '@souq/database';
import type { DomainEvent } from '@souq/types';
import { PrismaService } from '../prisma/prisma.service';

/** Wraps a handler so each (consumer, eventId) pair is processed at most once. */
@Injectable()
export class IdempotentConsumer {
  constructor(private readonly prisma: PrismaService) {}

  async once(consumer: string, event: DomainEvent, handler: () => Promise<void>): Promise<boolean> {
    try {
      await this.prisma.processedEvent.create({ data: { consumer, eventId: event.id } });
    } catch (err) {
      if (isUniqueViolation(err)) return false; // duplicate delivery
      throw err;
    }
    try {
      await handler();
      return true;
    } catch (err) {
      await this.prisma.processedEvent.delete({ where: { consumer_eventId: { consumer, eventId: event.id } } }).catch(() => undefined);
      throw err;
    }
  }
}
