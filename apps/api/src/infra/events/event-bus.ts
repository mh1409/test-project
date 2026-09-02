import type { DomainEvent, DomainEventName } from '@souq/types';

export type EventHandler = (event: DomainEvent) => Promise<void>;

/**
 * Transport abstraction for domain events. Implementations: in-memory (tests),
 * Redis Streams (default local), RabbitMQ (production). The outbox relay publishes;
 * consumers subscribe by event name.
 */
export interface EventBus {
  readonly name: string;
  publish(event: DomainEvent): Promise<void>;
  subscribe(consumerGroup: string, handler: EventHandler, names?: DomainEventName[]): Promise<void>;
  isHealthy(): Promise<boolean>;
  close(): Promise<void>;
}

export const EVENT_BUS = Symbol('EVENT_BUS');
