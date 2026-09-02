import { Injectable } from '@nestjs/common';
import type { DomainEvent, DomainEventName } from '@souq/types';

export interface RegisteredConsumer {
  /** Unique consumer name, e.g. "notifications.order-paid" — used for dedupe (ProcessedEvent). */
  name: string;
  events: DomainEventName[];
  handle: (event: DomainEvent) => Promise<void>;
}

/**
 * Domain event consumers register here; the worker subscribes them to the event bus wrapped
 * in IdempotentConsumer so redeliveries are harmless.
 */
@Injectable()
export class EventConsumerRegistry {
  private readonly consumers: RegisteredConsumer[] = [];

  register(consumer: RegisteredConsumer): void {
    if (this.consumers.some((c) => c.name === consumer.name)) throw new Error(`Consumer ${consumer.name} already registered`);
    this.consumers.push(consumer);
  }

  all(): readonly RegisteredConsumer[] {
    return this.consumers;
  }

  /** Dispatch an event to matching consumers (used by worker + in-process test harness). */
  async dispatch(event: DomainEvent, once: (name: string, event: DomainEvent, fn: () => Promise<void>) => Promise<boolean>): Promise<void> {
    for (const c of this.consumers) {
      if (!c.events.includes(event.name)) continue;
      await once(c.name, event, () => c.handle(event));
    }
  }
}
