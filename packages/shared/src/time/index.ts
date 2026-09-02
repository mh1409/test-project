export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const addMs = (date: Date, ms: number): Date => new Date(date.getTime() + ms);
export const addMinutes = (date: Date, minutes: number): Date => addMs(date, minutes * MINUTE);
export const addDays = (date: Date, days: number): Date => addMs(date, days * DAY);
export const isExpired = (date: Date | null | undefined, now = new Date()): boolean =>
  !date || date.getTime() <= now.getTime();

export function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Format a Date in a specific timezone and locale. Always store UTC; render per user. */
export function formatDateTime(
  date: Date,
  opts: { locale?: string; timeZone?: string; dateStyle?: 'short' | 'medium' | 'long'; timeStyle?: 'short' | 'medium' } = {},
): string {
  return new Intl.DateTimeFormat(opts.locale ?? 'ar-SA', {
    timeZone: opts.timeZone ?? 'Asia/Riyadh',
    dateStyle: opts.dateStyle ?? 'medium',
    timeStyle: opts.timeStyle ?? 'short',
  }).format(date);
}

/** Simple interval parser: "15m", "2h", "7d", "30s". */
export function parseDuration(input: string): number {
  const m = /^(\d+)(ms|s|m|h|d)$/.exec(input.trim());
  if (!m) throw new Error(`Invalid duration: ${input}`);
  const n = Number(m[1]);
  switch (m[2]) {
    case 'ms':
      return n;
    case 's':
      return n * SECOND;
    case 'm':
      return n * MINUTE;
    case 'h':
      return n * HOUR;
    case 'd':
      return n * DAY;
    default:
      throw new Error(`Invalid duration unit in ${input}`);
  }
}
