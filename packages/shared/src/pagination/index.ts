export interface OffsetPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export function normalizePage(page?: number, pageSize?: number) {
  const p = Math.max(1, Math.floor(page ?? 1));
  const s = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize ?? DEFAULT_PAGE_SIZE)));
  return { page: p, pageSize: s, skip: (p - 1) * s, take: s };
}

export function toOffsetPage<T>(items: T[], total: number, page: number, pageSize: number): OffsetPage<T> {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function encodeCursor(payload: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor<T extends Record<string, string | number>>(cursor?: string | null): T | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

/** Build a cursor page from `take + 1` fetched rows. */
export function toCursorPage<T>(rows: T[], take: number, makeCursor: (last: T) => string): CursorPage<T> {
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  const last = items[items.length - 1];
  return { items, hasMore, nextCursor: hasMore && last ? makeCursor(last) : null };
}
