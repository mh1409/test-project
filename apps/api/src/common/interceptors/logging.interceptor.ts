import { type CallHandler, type ExecutionContext, Inject, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Metrics } from '@souq/observability';
import type { Response } from 'express';
import { type Observable, tap } from 'rxjs';
import { LOGGER, METRICS, type Logger } from '../../infra/config/config.module';
import type { AppRequest } from '../types/request';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject(LOGGER) private readonly logger: Logger, @Inject(METRICS) private readonly metrics: Metrics) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AppRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();
    const route = (req.route as { path?: string } | undefined)?.path ?? req.path;
    const finish = () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const status = String(res.statusCode);
      this.metrics.httpRequestDuration.observe({ method: req.method, route, status }, ms / 1000);
      this.metrics.httpRequestsTotal.inc({ method: req.method, route, status });
      if (!route.startsWith('/health') && !route.startsWith('/metrics')) {
        this.logger.info({ method: req.method, path: req.originalUrl, status: res.statusCode, ms: Math.round(ms), userId: req.user?.id }, 'request');
      }
    };
    return next.handle().pipe(
      tap({
        next: finish,
        error: finish,
      }),
    );
  }
}
