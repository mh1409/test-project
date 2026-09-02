import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ValidationError } from '@souq/shared';
import type { Response } from 'express';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { IDEMPOTENT_KEY } from '../../common/decorators';
import type { AppRequest } from '../../common/types/request';
import { IdempotencyService } from './idempotency.service';

const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

/** Applies idempotency to handlers decorated with @Idempotent(scope). */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly idempotency: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<{ scope: string; required: boolean } | undefined>(IDEMPOTENT_KEY, context.getHandler());
    if (!meta || context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AppRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const headerKey = req.header('idempotency-key') ?? (req.body as { idempotencyKey?: string } | undefined)?.idempotencyKey;
    if (!headerKey) {
      if (meta.required) throw new ValidationError('Idempotency-Key header is required');
      return next.handle();
    }
    if (!KEY_RE.test(headerKey)) throw new ValidationError('Idempotency-Key must be 8-128 chars of [A-Za-z0-9_-]');

    return from(
      (async () => {
        const result = await this.idempotency.execute(
          { key: headerKey, scope: meta.scope, userId: req.user?.id ?? req.anonymousId ?? null, payload: { body: req.body, params: req.params, path: req.path } },
          async () => ({ statusCode: res.statusCode, body: await lastValueFrom(next.handle(), { defaultValue: null }) }),
        );
        if (result.replayed) {
          res.setHeader('Idempotent-Replayed', 'true');
          res.status(result.statusCode);
        }
        return result.body;
      })(),
    );
  }
}
