import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { requestContext } from '@souq/observability';
import { resolveLocale } from '@souq/i18n';
import type { NextFunction, Response } from 'express';
import type { AppRequest } from '../types/request';

const SAFE_ID = /^[A-Za-z0-9._:-]{8,128}$/;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: AppRequest, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const requestId = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    const corr = req.header('x-correlation-id');
    const correlationId = corr && SAFE_ID.test(corr) ? corr : requestId;
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const anon = req.header('x-anonymous-id') ?? (req.cookies as Record<string, string> | undefined)?.souq_anon;
    if (anon && SAFE_ID.test(anon)) req.anonymousId = anon;

    const queryLocale = typeof req.query.locale === 'string' ? req.query.locale : undefined;
    const cookieLocale = (req.cookies as Record<string, string> | undefined)?.NEXT_LOCALE;
    req.locale = resolveLocale(queryLocale ?? cookieLocale ?? req.header('accept-language'));

    requestContext.run({ requestId, correlationId, ip: req.ip, path: req.path }, () => next());
  }
}
