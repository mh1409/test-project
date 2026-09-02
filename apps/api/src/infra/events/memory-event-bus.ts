import type { DomainEvent, DomainEventName } from '@souq/types';
import type { EventBus, EventHandler } from './event-bus';

export class MemoryEventBus implements EventBus {
  readonly name = 'memory';
  private readonly subscribers: { group: string; handler: EventHandler; names?: DomainEventName[] }[] = [];
  readonly published: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
    for (const s of this.subscribers) {
      if (s.names && !s.names.includes(event.name)) continue;
      await s.handler(event);
    }
  }
  async subscribe(group: string, handler: EventHandler, names?: DomainEventName[]): Promise<void> {
    this.subscribers.push({ group, handler, names });
  }
  async isHealthy(): Promise<boolean> {
    return true;
  }
  async close(): Promise<void> {
    this.subscribers.length = 0;
  }
}
