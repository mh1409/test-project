import { ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Prisma } from '@souq/database';
import { AppError, type ApiErrorBody } from '@souq/shared';
import type { Metrics } from '@souq/observability';
import type { Response } from 'express';
import { ENV, LOGGER, METRICS, type Env, type Logger } from '../../infra/config/config.module';
import type { AppRequest } from '../types/request';

/** Converts every error into the standard {code, message, details, requestId} body. Never leaks stack traces. */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(ENV) private readonly env: Env,
    @Inject(METRICS) private readonly metrics: Metrics,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<AppRequest>();
    const requestId = req.requestId;
    const { status, body } = this.map(exception, requestId);

    if (status >= 500) {
      this.logger.error({ err: exception, path: req.originalUrl, method: req.method }, 'Unhandled error');
    } else if (status !== 404) {
      this.logger.debug({ code: body.code, status, path: req.originalUrl }, 'Request error');
    }
    const route = (req.route as { path?: string } | undefined)?.path ?? req.path;
    this.metrics.httpErrorsTotal.inc({ method: req.method, route, code: body.code });

    if (!res.headersSent) {
      res.status(status).json(body);
    }
  }

  private map(exception: unknown, requestId: string): { status: number; body: ApiErrorBody } {
    if (exception instanceof AppError) {
      return { status: exception.status, body: exception.toBody(requestId) };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message = typeof response === 'string' ? response : ((response as { message?: string | string[] }).message ?? exception.message);
      const code = httpStatusToCode(status);
      return { status, body: { code, message: Array.isArray(message) ? message.join('; ') : message, requestId } };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return { status: 409, body: { code: 'CONFLICT', message: 'A record with the same unique value already exists', requestId } };
      if (exception.code === 'P2025') return { status: 404, body: { code: 'NOT_FOUND', message: 'Resource not found', requestId } };
      if (exception.code === 'P2003') return { status: 409, body: { code: 'CONFLICT', message: 'Related resource constraint violated', requestId } };
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: 400, body: { code: 'VALIDATION_ERROR', message: 'Invalid request', requestId } };
    }
    if (exception instanceof SyntaxError && /JSON/.test(exception.message)) {
      return { status: 400, body: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body', requestId } };
    }
    const maybe = exception as { type?: string; status?: number };
    if (maybe?.type === 'entity.too.large') return { status: 413, body: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large', requestId } };
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: 'INTERNAL_ERROR',
        message: this.env.NODE_ENV === 'production' ? 'Internal server error' : ((exception as Error)?.message ?? 'Internal server error'),
        requestId,
      },
    };
  }
}

function httpStatusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 415:
      return 'UNSUPPORTED_MEDIA_TYPE';
    case 429:
      return 'RATE_LIMITED';
    case 503:
      return 'DEPENDENCY_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR';
  }
}
