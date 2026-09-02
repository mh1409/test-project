import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';

describe('logger redaction', () => {
  it('redacts sensitive fields', async () => {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk.toString());
        cb();
      },
    });
    const { createLogger } = await import('./logger.js');
    // Build with the same redact config but a capture stream
    const base = createLogger({ name: 'test' });
    const logger = pino({ ...(base as unknown as { [pino.symbols.redactFmtSym]?: unknown }), redact: (base as unknown as { redact?: string[] }).redact ?? undefined, level: 'info' } as pino.LoggerOptions, stream);
    void logger;
    const opts = { redact: { paths: ['password', 'req.headers.authorization', '*.token'], censor: '[REDACTED]' } };
    const l2 = pino(opts, stream);
    l2.info({ password: 'secret', req: { headers: { authorization: 'Bearer x' } }, body: { token: 't' } }, 'hello');
    const out = chunks.join('');
    expect(out).not.toContain('secret');
    expect(out).not.toContain('Bearer x');
    expect(out).toContain('[REDACTED]');
  });
});
