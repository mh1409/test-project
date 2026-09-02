import { Injectable } from '@nestjs/common';
import { redact } from '@souq/shared';
import { requestContext } from '@souq/observability';
import type { Prisma } from '@souq/database';
import { PrismaService, type Tx } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  actorType?: 'USER' | 'SYSTEM' | 'IMPERSONATION';
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/** Immutable audit log writer (DB trigger prevents UPDATE/DELETE). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: Tx): Promise<void> {
    const ctx = requestContext.get();
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorType: entry.actorType ?? (entry.actorId ? 'USER' : 'SYSTEM'),
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: entry.before === undefined ? undefined : (redact(entry.before) as Prisma.InputJsonValue),
        after: entry.after === undefined ? undefined : (redact(entry.after) as Prisma.InputJsonValue),
        ipAddress: entry.ip ?? ctx?.ip ?? null,
        userAgent: entry.userAgent ?? null,
        requestId: ctx?.requestId ?? null,
        metadata: entry.metadata ? (redact(entry.metadata) as Prisma.InputJsonValue) : undefined,
      },
    });
  }
}
