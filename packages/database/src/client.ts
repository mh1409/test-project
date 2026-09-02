import { PrismaClient, Prisma } from '@prisma/client';

export { Prisma, PrismaClient };
export type * from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;
export type DbClient = PrismaClient | TransactionClient;

export interface CreatePrismaOptions {
  url?: string;
  log?: Prisma.LogLevel[];
}

export function createPrismaClient(options: CreatePrismaOptions = {}): PrismaClient {
  return new PrismaClient({
    datasourceUrl: options.url ?? process.env.DATABASE_URL,
    log: options.log ?? (process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']),
    transactionOptions: { maxWait: 5000, timeout: 15000 },
  });
}

/** Detects Prisma unique constraint violations (P2002). */
export function isUniqueViolation(err: unknown, target?: string): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    if (!target) return true;
    const meta = err.meta as { target?: string[] | string } | undefined;
    const t = meta?.target;
    return Array.isArray(t) ? t.includes(target) : typeof t === 'string' ? t.includes(target) : true;
  }
  return false;
}

/** Postgres serialization failure or deadlock, safe to retry. */
export function isRetryableTxError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2034' || err.code === 'P2028';
  }
  const code = (err as { code?: string })?.code;
  return code === '40001' || code === '40P01';
}
