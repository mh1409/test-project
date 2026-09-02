import { Global, Module, type OnModuleDestroy, Inject } from '@nestjs/common';
import { ENV, LOGGER, type Env, type Logger } from '../config/config.module';
import { RedisService } from '../redis/redis.service';
import { EVENT_BUS, type EventBus } from './event-bus';
import { EventConsumerRegistry } from './consumer-registry';
import { IdempotentConsumer } from './idempotent-consumer';
import { MemoryEventBus } from './memory-event-bus';
import { OutboxService } from './outbox.service';
import { RabbitMqEventBus } from './rabbitmq-event-bus';
import { RedisEventBus } from './redis-event-bus';

@Global()
@Module({
  providers: [
    {
      provide: EVENT_BUS,
      useFactory: (env: Env, redis: RedisService, logger: Logger): EventBus => {
        if (env.NODE_ENV === 'test' || env.EVENT_BUS === 'memory') return new MemoryEventBus();
        if (env.EVENT_BUS === 'rabbitmq') return new RabbitMqEventBus(env.RABBITMQ_URL, logger);
        const pub = redis.duplicate();
        if (!pub) {
          logger.warn('Redis unavailable for event bus; using in-memory bus');
          return new MemoryEventBus();
        }
        return new RedisEventBus(pub, () => redis.duplicate(), logger);
      },
      inject: [ENV, RedisService, LOGGER],
    },
    OutboxService,
    IdempotentConsumer,
    EventConsumerRegistry,
  ],
  exports: [EVENT_BUS, OutboxService, IdempotentConsumer, EventConsumerRegistry],
})
export class EventsModule implements OnModuleDestroy {
  constructor(@Inject(EVENT_BUS) private readonly bus: EventBus) {}
  async onModuleDestroy(): Promise<void> {
    await this.bus.close();
  }
}
