import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError, UnauthenticatedError } from '@souq/shared';
import { ENV, type Env } from '../../infra/config/config.module';
import { TokenService } from '../../infra/auth/token.service';
import { SessionValidator } from '../../infra/auth/session-validator';
import { IS_PUBLIC_KEY } from '../decorators';
import type { AppRequest } from '../types/request';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/**
 * Authenticates via Bearer header or the `souq_access` HttpOnly cookie.
 * Public routes still get `req.user` populated when a valid token is present.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionValidator,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest<AppRequest>();
    const { token, fromCookie } = this.extract(req);
    if (token && fromCookie && !SAFE_METHODS.has(req.method)) this.assertSameOrigin(req);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthenticatedError();
    }
    try {
      const claims = await this.tokens.verifyAccessToken(token);
      const valid = await this.sessions.isValid(claims.sub, claims.sid, claims.tv);
      if (!valid) throw new AppError('TOKEN_INVALID', 'Session is no longer valid');
      req.user = {
        id: claims.sub,
        email: claims.email,
        roles: claims.roles ?? [],
        permissions: claims.perms ?? [],
        sellerId: claims.sellerId ?? null,
        sessionId: claims.sid,
        impersonatorId: claims.imp,
        locale: claims.locale ?? req.locale,
      };
      return true;
    } catch (err) {
      if (isPublic) return true;
      throw err;
    }
  }

  private extract(req: AppRequest): { token: string | null; fromCookie: boolean } {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return { token: header.slice(7).trim() || null, fromCookie: false };
    const cookie = (req.cookies as Record<string, string> | undefined)?.souq_access;
    return { token: cookie ?? null, fromCookie: true };
  }

  /** CSRF defence for cookie sessions: Origin (or Referer) must be one of the configured web origins. */
  private assertSameOrigin(req: AppRequest): void {
    const origin = req.headers.origin ?? (req.headers.referer ? safeOrigin(req.headers.referer) : undefined);
    if (!origin || !this.env.CORS_ORIGINS.includes(origin)) {
      throw new AppError('FORBIDDEN', 'Cross-site request blocked');
    }
  }
}
