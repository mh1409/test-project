import amqplib, { type Channel, type ChannelModel } from 'amqplib';
import type { DomainEvent, DomainEventName } from '@souq/types';
import type { Logger } from '@souq/observability';
import type { EventBus, EventHandler } from './event-bus';

const EXCHANGE = 'souq.events';
const DLX = 'souq.events.dlx';

/** RabbitMQ topic exchange transport with per-consumer-group durable queues and a dead-letter exchange. */
export class RabbitMqEventBus implements EventBus {
  readonly name = 'rabbitmq';
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly url: string, private readonly logger: Logger) {}

  private async ensure(): Promise<Channel> {
    if (this.channel) return this.channel;
    this.connection = await amqplib.connect(this.url);
    this.connection.on('error', (err) => this.logger.warn({ err: err.message }, 'RabbitMQ connection error'));
    this.connection.on('close', () => {
      this.channel = null;
      this.connection = null;
    });
    const ch = await this.connection.createChannel();
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
    await ch.assertExchange(DLX, 'topic', { durable: true });
    this.channel = ch;
    return ch;
  }

  async publish(event: DomainEvent): Promise<void> {
    const ch = await this.ensure();
    ch.publish(EXCHANGE, event.name, Buffer.from(JSON.stringify(event)), { persistent: true, messageId: event.id, contentType: 'application/json', timestamp: Date.now() });
  }

  async subscribe(group: string, handler: EventHandler, names?: DomainEventName[]): Promise<void> {
    const ch = await this.ensure();
    const queue = `souq.${group}`;
    await ch.assertQueue(`${queue}.dlq`, { durable: true });
    await ch.bindQueue(`${queue}.dlq`, DLX, `${group}.#`);
    await ch.assertQueue(queue, { durable: true, deadLetterExchange: DLX, deadLetterRoutingKey: `${group}.dead` });
    for (const name of names ?? ['#']) await ch.bindQueue(queue, EXCHANGE, name);
    await ch.prefetch(20);
    await ch.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const event = JSON.parse(msg.content.toString()) as DomainEvent;
        await handler(event);
        ch.ack(msg);
      } catch (err) {
        this.logger.error({ err }, 'Event handler failed; dead-lettering');
        ch.nack(msg, false, false);
      }
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.ensure();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }
}
