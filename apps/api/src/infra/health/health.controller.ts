import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Metrics } from '@souq/observability';
import type { Response } from 'express';
import { Public } from '../../common/decorators';
import { ENV, METRICS, type Env } from '../config/config.module';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/** Liveness/readiness/health endpoints outside the versioned API prefix. */
@ApiExcludeController()
@Controller()
export class HealthController {
  private readonly startedAt = Date.now();
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Get('live')
  live() {
    return { status: 'ok', uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000) };
  }

  /** Ready only when critical dependencies (database; redis if REDIS_REQUIRED) respond. */
  @Public()
  @Get('ready')
  async ready(@Res() res: Response) {
    const [db, redis] = await Promise.all([this.prisma.isHealthy(), this.redis.ping()]);
    const ready = db && (!this.env.REDIS_REQUIRED || redis);
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks: { database: db, redis } });
  }

  @Public()
  @Get('health')
  async health(@Res() res: Response) {
    const [db, redis] = await Promise.all([this.prisma.isHealthy(), this.redis.ping()]);
    const degraded = !redis;
    res.status(db ? 200 : 503).json({
      status: db ? (degraded ? 'degraded' : 'ok') : 'down',
      version: process.env.APP_VERSION ?? 'dev',
      checks: { database: db ? 'up' : 'down', redis: redis ? 'up' : 'down' },
      timestamp: new Date().toISOString(),
    });
  }

  @Public()
  @Get('metrics')
  async prometheus(@Res() res: Response) {
    if (!this.env.METRICS_ENABLED) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', this.metrics.contentType);
    res.send(await this.metrics.render());
  }
}
