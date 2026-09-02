/**
 * Standardized application error taxonomy shared by API, workers and SDK.
 * Every error maps to an HTTP status and a stable machine-readable code.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_STATE_TRANSITION'
  | 'INSUFFICIENT_STOCK'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REQUIRED'
  | 'PRICE_CHANGED'
  | 'COUPON_INVALID'
  | 'BID_TOO_LOW'
  | 'AUCTION_CLOSED'
  | 'FEATURE_DISABLED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'ACCOUNT_LOCKED'
  | 'EMAIL_NOT_VERIFIED'
  | 'MFA_REQUIRED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID';

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  MFA_REQUIRED: 401,
  EMAIL_NOT_VERIFIED: 403,
  FORBIDDEN: 403,
  ACCOUNT_LOCKED: 423,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  INVALID_STATE_TRANSITION: 409,
  INSUFFICIENT_STOCK: 409,
  PRICE_CHANGED: 409,
  BID_TOO_LOW: 409,
  AUCTION_CLOSED: 409,
  COUPON_INVALID: 422,
  PAYMENT_FAILED: 402,
  PAYMENT_REQUIRED: 402,
  RATE_LIMITED: 429,
  FEATURE_DISABLED: 404,
  DEPENDENCY_UNAVAILABLE: 503,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
};

export interface ApiErrorBody {
  code: ErrorCode | string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(code: ErrorCode, message?: string, details?: unknown, options?: { cause?: unknown }) {
    super(message ?? code, options);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_HTTP_STATUS[code];
    this.details = details;
    this.expose = this.status < 500;
  }

  toBody(requestId?: string): ApiErrorBody {
    return {
      code: this.code,
      message: this.expose ? this.message : 'Internal server error',
      details: this.expose ? this.details : undefined,
      requestId,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super('VALIDATION_ERROR', message, details);
  }
}
export class NotFoundError extends AppError {
  constructor(entity = 'Resource', id?: string) {
    super('NOT_FOUND', id ? `${entity} ${id} not found` : `${entity} not found`);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super('FORBIDDEN', message);
  }
}
export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHENTICATED', message);
  }
}
export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super('CONFLICT', message, details);
  }
}
export class InvalidStateTransitionError extends AppError {
  constructor(entity: string, from: string, to: string) {
    super('INVALID_STATE_TRANSITION', `${entity} cannot transition from ${from} to ${to}`, {
      entity,
      from,
      to,
    });
  }
}
export class InsufficientStockError extends AppError {
  constructor(details?: unknown) {
    super('INSUFFICIENT_STOCK', 'Insufficient stock for one or more items', details);
  }
}
export class FeatureDisabledError extends AppError {
  constructor(flag: string) {
    super('FEATURE_DISABLED', `Feature "${flag}" is not enabled`);
  }
}
export class DependencyUnavailableError extends AppError {
  constructor(dependency: string) {
    super('DEPENDENCY_UNAVAILABLE', `${dependency} is temporarily unavailable`);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError || (typeof err === 'object' && err !== null && 'code' in err && 'status' in err && (err as AppError).name === 'AppError');
}
