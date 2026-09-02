import { describe, expect, it } from 'vitest';
import { hashPassword, maskEmail, redact, safeEqual, verifyPassword } from './index.js';

describe('security', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('Str0ng!Passw0rd');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('Str0ng!Passw0rd', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  }, 20_000);
  it('redacts sensitive keys deeply', () => {
    const out = redact({
      password: 'x',
      headers: { Authorization: 'Bearer abc', cookie: 'sid=1', 'x-request-id': 'r1' },
      nested: [{ refreshToken: 't' }],
      safe: 'ok',
    });
    expect(out.password).toBe('[REDACTED]');
    expect(out.headers.Authorization).toBe('[REDACTED]');
    expect(out.headers.cookie).toBe('[REDACTED]');
    expect(out.headers['x-request-id']).toBe('r1');
    expect(out.nested[0]?.refreshToken).toBe('[REDACTED]');
    expect(out.safe).toBe('ok');
  });
  it('masks emails and compares safely', () => {
    expect(maskEmail('buyer@example.local')).toBe('bu***@example.local');
    expect(safeEqual('a', 'a')).toBe(true);
    expect(safeEqual('a', 'b')).toBe(false);
  });
});
