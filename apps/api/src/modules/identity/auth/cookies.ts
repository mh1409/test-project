import type { Response } from 'express';
import type { Env } from '@souq/config';

export const ACCESS_COOKIE = 'souq_access';
export const REFRESH_COOKIE = 'souq_refresh';

export function setAuthCookies(res: Response, env: Env, tokens: { accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number }): void {
  const base = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax' as const, domain: env.COOKIE_DOMAIN, path: '/' };
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base, maxAge: tokens.expiresIn * 1000 });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base, path: `/${env.API_GLOBAL_PREFIX}/v1/auth`, maxAge: tokens.refreshExpiresIn * 1000 });
}

export function clearAuthCookies(res: Response, env: Env): void {
  const base = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax' as const, domain: env.COOKIE_DOMAIN };
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: `/${env.API_GLOBAL_PREFIX}/v1/auth` });
}
