import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Permission } from '@souq/types';
import type { FeatureFlagKey } from '@souq/config';
import type { AppRequest, AuthUser } from '../types/request';

export const IS_PUBLIC_KEY = 'isPublic';
/** Route does not require authentication (user is still attached when a valid token is present). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'permissions';
/** Require ALL listed permissions. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const ANY_PERMISSION_KEY = 'anyPermissions';
/** Require ANY of the listed permissions. */
export const RequireAnyPermission = (...permissions: Permission[]) => SetMetadata(ANY_PERMISSION_KEY, permissions);

export const FEATURE_FLAG_KEY = 'featureFlag';
export const RequireFeature = (flag: FeatureFlagKey) => SetMetadata(FEATURE_FLAG_KEY, flag);

export const RATE_LIMIT_KEY = 'rateLimit';
export interface RateLimitOptions {
  /** policy name, e.g. "login" */
  name: string;
  limit: number;
  windowSeconds: number;
  /** key by ip (default), user, or both */
  keyBy?: 'ip' | 'user' | 'ip+user';
}
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

export const IDEMPOTENT_KEY = 'idempotent';
/** Marks a mutating endpoint as idempotent via the Idempotency-Key header. */
export const Idempotent = (scope: string, options: { required?: boolean } = {}) => SetMetadata(IDEMPOTENT_KEY, { scope, required: options.required ?? true });

export const AUDIT_KEY = 'audit';
export interface AuditOptions {
  action: string;
  entityType: string;
  /** request param carrying the entity id (default "id") */
  idParam?: string;
}
export const Audited = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);

export const CurrentUser = createParamDecorator((data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  const user = req.user;
  if (!user) return undefined;
  return data ? user[data] : user;
});

export const RequestLocale = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AppRequest>().locale);
export const AnonymousId = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AppRequest>().anonymousId);
export const RequestMeta = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  return { ip: req.ip, userAgent: req.headers['user-agent'] ?? undefined, requestId: req.requestId };
});
export interface RequestMetaData {
  ip?: string;
  userAgent?: string;
  requestId: string;
}
