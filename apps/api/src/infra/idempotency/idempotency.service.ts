import { Injectable } from '@nestjs/common';
import { AppError, sha256 } from '@souq/shared';
import { isUniqueViolation } from '@souq/database';
import { PrismaService } from '../prisma/prisma.service';

export interface IdempotentResult<T> {
  replayed: boolean;
  statusCode: number;
  body: T;
}

/**
 * Idempotency keys for sensitive operations (checkout, payment, refund, payout).
 * - Same key + same request hash => cached response is replayed.
 * - Same key + different payload => IDEMPOTENCY_CONFLICT (409).
 * - Concurrent duplicate => second caller waits/gets 409 while first is in flight.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(
    params: { key: string; scope: string; userId?: string | null; payload: unknown; ttlHours?: number },
    handler: () => Promise<{ statusCode?: number; body: T }>,
  ): Promise<IdempotentResult<T>> {
    const compositeKey = `${params.scope}:${params.userId ?? 'anon'}:${params.key}`;
    const requestHash = sha256(JSON.stringify(params.payload ?? null));
    const expiresAt = new Date(Date.now() + (params.ttlHours ?? 24) * 3600_000);

    try {
      await this.prisma.idempotencyKey.create({
        data: { key: compositeKey, scope: params.scope, userId: params.userId ?? null, requestHash, lockedAt: new Date(), expiresAt },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const existing = await this.prisma.idempotencyKey.findUnique({ where: { key: compositeKey } });
      if (!existing) throw err;
      if (existing.requestHash !== requestHash) throw new AppError('IDEMPOTENCY_CONFLICT', 'Idempotency-Key was already used with a different payload');
      if (existing.statusCode == null) {
        // In flight: stale lock (> 60s) is taken over, otherwise report conflict.
        if (existing.lockedAt && Date.now() - existing.lockedAt.getTime() < 60_000) {
          throw new AppError('IDEMPOTENCY_CONFLICT', 'A request with this Idempotency-Key is still being processed');
        }
        await this.prisma.idempotencyKey.update({ where: { key: compositeKey }, data: { lockedAt: new Date() } });
      } else {
        return { replayed: true, statusCode: existing.statusCode, body: existing.responseBody as T };
      }
    }

    try {
      const result = await handler();
      const statusCode = result.statusCode ?? 200;
      await this.prisma.idempotencyKey.update({
        where: { key: compositeKey },
        data: { statusCode, responseBody: result.body as object, lockedAt: null },
      });
      return { replayed: false, statusCode, body: result.body };
    } catch (err) {
      // Business failures are not cached so the client may retry; free the lock.
      await this.prisma.idempotencyKey.delete({ where: { key: compositeKey } }).catch(() => undefined);
      throw err;
    }
  }

  async purgeExpired(): Promise<number> {
    const res = await this.prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return res.count;
  }
}
