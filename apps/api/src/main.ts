import './instrumentation';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import express from 'express';
import { loadEnv } from '@souq/config';
import { createLogger } from '@souq/observability';
import { AppModule } from './app.module';
import { NestPinoLogger } from './infra/config/nest-logger';
import { RedisIoAdapter } from './infra/redis/redis-io.adapter';
import { RedisService } from './infra/redis/redis.service';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ name: 'souq-api', level: env.LOG_LEVEL });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new NestPinoLogger(logger),
    bufferLogs: true,
    rawBody: true,
  });

  app.set('trust proxy', env.TRUST_PROXY ? 1 : false);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: env.NODE_ENV === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id', 'X-Correlation-Id', 'Accept-Language', 'X-Anonymous-Id', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 600,
  });
  app.setGlobalPrefix(`${env.API_GLOBAL_PREFIX}/v1`, { exclude: ['health', 'ready', 'live', 'metrics', 'robots.txt'] });
  app.enableShutdownHooks();

  // WebSocket adapter with Redis pub/sub when available (multi-instance safe)
  const redis = app.get(RedisService, { strict: false });
  const ioAdapter = new RedisIoAdapter(app, env.CORS_ORIGINS);
  await ioAdapter.connect(redis);
  app.useWebSocketAdapter(ioAdapter);

  if (env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Souq Marketplace API')
      .setDescription('Multi-vendor marketplace REST API. All monetary amounts are integers in minor units.')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'Idempotency-Key', in: 'header' }, 'idempotency')
      .addServer(env.API_URL)
      .build();
    const document = SwaggerModule.createDocument(app, config, { deepScanRoutes: true });
    SwaggerModule.setup(`${env.API_GLOBAL_PREFIX}/docs`, app, document, {
      jsonDocumentUrl: `${env.API_GLOBAL_PREFIX}/docs-json`,
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(env.API_PORT, '0.0.0.0');
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'API listening');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown started');
    const timer = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 25_000).unref();
    try {
      await app.close();
      clearTimeout(timer);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled rejection'));
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
