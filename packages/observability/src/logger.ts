import pino, { type Logger, type LoggerOptions } from 'pino';
import { requestContext } from './context.js';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.otp',
  '*.mfaSecret',
  '*.cardNumber',
  '*.cvv',
  '*.iban',
  '*.secret',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
];

export interface CreateLoggerOptions {
  name: string;
  level?: string;
  pretty?: boolean;
}

export function createLogger(opts: CreateLoggerOptions): Logger {
  const options: LoggerOptions = {
    name: opts.name,
    level: opts.level ?? 'info',
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    base: { service: opts.name, pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    mixin() {
      const ctx = requestContext.get();
      return ctx ? { requestId: ctx.requestId, correlationId: ctx.correlationId, userId: ctx.userId } : {};
    },
  };
  return pino(options);
}

export type { Logger };
