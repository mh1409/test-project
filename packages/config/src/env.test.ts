import { describe, expect, it } from 'vitest';
import { loadEnv } from './index.js';

const base = {
  DATABASE_URL: 'postgresql://x',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
};

describe('env', () => {
  it('loads defaults', () => {
    const env = loadEnv(base, { cache: false });
    expect(env.API_PORT).toBe(3001);
    expect(env.CORS_ORIGINS).toContain('http://localhost:3000');
    expect(env.FEATURE_AUCTIONS).toBe(true);
  });
  it('fails on missing secrets with readable message', () => {
    expect(() => loadEnv({ DATABASE_URL: 'x' }, { cache: false })).toThrow(/JWT_ACCESS_SECRET/);
  });
  it('rejects unsafe production config', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' }, { cache: false })).toThrow(/COOKIE_SECURE|webhook/i);
  });
});
