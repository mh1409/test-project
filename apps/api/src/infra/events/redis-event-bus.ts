import type Redis from 'ioredis';
import type { DomainEvent, DomainEventName } from '@souq/types';
import type { Logger } from '@souq/observability';
import type { EventBus, EventHandler } from './event-bus';

const STREAM = 'souq:events';

/** Redis Streams transport with consumer groups (at-least-once; consumers must be idempotent). */
export class RedisEventBus implements EventBus {
  readonly name = 'redis';
  private readonly loops: { stop: boolean }[] = [];

  constructor(private readonly publisher: Redis, private readonly consumerFactory: () => Redis | null, private readonly logger: Logger) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.publisher.xadd(STREAM, 'MAXLEN', '~', '100000', '*', 'event', JSON.stringify(event));
  }

  async subscribe(group: string, handler: EventHandler, names?: DomainEventName[]): Promise<void> {
    const client = this.consumerFactory();
    if (!client) throw new Error('Redis consumer connection unavailable');
    try {
      await client.xgroup('CREATE', STREAM, group, '0', 'MKSTREAM');
    } catch (err) {
      if (!String((err as Error).message).includes('BUSYGROUP')) throw err;
    }
    const state = { stop: false };
    this.loops.push(state);
    const consumer = `${group}-${process.pid}`;
    void (async () => {
      while (!state.stop) {
        try {
          const res = (await client.xreadgroup('GROUP', group, consumer, 'COUNT', 20, 'BLOCK', 5000, 'STREAMS', STREAM, '>')) as [string, [string, string[]][]][] | null;
          if (!res) continue;
          for (const [, entries] of res) {
            for (const [id, fields] of entries) {
              const raw = fields[1];
              if (!raw) continue;
              const event = JSON.parse(raw) as DomainEvent;
              if (!names || names.includes(event.name)) {
                try {
                  await handler(event);
                } catch (err) {
                  this.logger.error({ err, event: event.name, id: event.id }, 'Event handler failed');
                  continue; // leave unacked for retry via XAUTOCLAIM by ops tooling
                }
              }
              await client.xack(STREAM, group, id);
            }
          }
        } catch (err) {
          if (!state.stop) {
            this.logger.warn({ err: (err as Error).message }, 'Event bus read error; retrying');
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
      client.disconnect();
    })();
  }

  async isHealthy(): Promise<boolean> {
    try {
      return (await this.publisher.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    for (const l of this.loops) l.stop = true;
  }
}
