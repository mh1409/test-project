import { createPrismaClient, type PrismaClient } from '@souq/database';

/** Tables in FK-safe truncation order are not needed: TRUNCATE ... CASCADE handles it. */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations')`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  // Immutability triggers only guard UPDATE/DELETE; TRUNCATE is allowed for test isolation.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export function createTestPrisma(url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error('DATABASE_URL_TEST or DATABASE_URL must be set for integration tests');
  return createPrismaClient({ url, log: ['error'] });
}
