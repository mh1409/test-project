import { Inject, Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { AppError, parseDuration } from '@souq/shared';
import type { Permission } from '@souq/types';
import { ENV, type Env } from '../config/config.module';

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  sid: string;
  email: string;
  roles: string[];
  perms: Permission[];
  sellerId?: string | null;
  tv: number; // token version
  imp?: string; // impersonator id
  locale?: string;
}

@Injectable()
export class TokenService {
  private readonly accessSecret: Uint8Array;
  private readonly refreshSecret: Uint8Array;
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    this.refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
    this.accessTtlSeconds = Math.floor(parseDuration(env.JWT_ACCESS_TTL) / 1000);
    this.refreshTtlSeconds = Math.floor(parseDuration(env.JWT_REFRESH_TTL) / 1000);
  }

  async signAccessToken(claims: Omit<AccessTokenClaims, 'iat' | 'exp' | 'iss' | 'aud'>): Promise<string> {
    return new SignJWT(claims as JWTPayload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setIssuer(this.env.APP_URL)
      .setAudience('souq-api')
      .setExpirationTime(`${this.accessTtlSeconds}s`)
      .sign(this.accessSecret);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret, { issuer: this.env.APP_URL, audience: 'souq-api', algorithms: ['HS256'] });
      return payload as AccessTokenClaims;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'ERR_JWT_EXPIRED') throw new AppError('TOKEN_EXPIRED', 'Access token expired');
      throw new AppError('TOKEN_INVALID', 'Invalid access token');
    }
  }

  /** Refresh tokens are opaque random strings; only their hash is persisted. */
  async signRefreshToken(sessionId: string, userId: string): Promise<string> {
    return new SignJWT({ sid: sessionId, sub: userId, typ: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setJti(crypto.randomUUID())
      .setExpirationTime(`${this.refreshTtlSeconds}s`)
      .sign(this.refreshSecret);
  }

  async verifyRefreshToken(token: string): Promise<{ sid: string; sub: string }> {
    try {
      const { payload } = await jwtVerify(token, this.refreshSecret, { algorithms: ['HS256'] });
      if (payload.typ !== 'refresh' || typeof payload.sid !== 'string' || typeof payload.sub !== 'string') throw new Error('bad');
      return { sid: payload.sid, sub: payload.sub };
    } catch {
      throw new AppError('TOKEN_INVALID', 'Invalid refresh token');
    }
  }
}
