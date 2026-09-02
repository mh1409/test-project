import { Global, Module } from '@nestjs/common';
import { loadEnv, type Env } from '@souq/config';
import { createLogger, Metrics, type Logger } from '@souq/observability';

export const ENV = Symbol('ENV');
export const LOGGER = Symbol('LOGGER');
export const METRICS = Symbol('METRICS');

export type { Env, Logger };

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: (): Env => loadEnv() },
    {
      provide: LOGGER,
      useFactory: (env: Env): Logger => createLogger({ name: env.OTEL_SERVICE_NAME, level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL }),
      inject: [ENV],
    },
    { provide: METRICS, useFactory: (): Metrics => new Metrics() },
  ],
  exports: [ENV, LOGGER, METRICS],
})
export class ConfigModule {}
