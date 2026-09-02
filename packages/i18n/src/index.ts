import { DEFAULT_LOCALE, type Locale, type LocalizedText, isLocale, isRtl, SUPPORTED_LOCALES } from '@souq/types';

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale, isRtl };
export type { Locale, LocalizedText };

export const LOCALE_META: Record<Locale, { name: string; nativeName: string; dir: 'rtl' | 'ltr'; intl: string; numbering: 'latn' | 'arab' }> = {
  ar: { name: 'Arabic', nativeName: 'العربية', dir: 'rtl', intl: 'ar-SA', numbering: 'latn' },
  en: { name: 'English', nativeName: 'English', dir: 'ltr', intl: 'en-US', numbering: 'latn' },
};

/** Pick localized field from an entity with `<field>Ar` / `<field>En` columns, with fallback. */
export function pickLocalized<T extends Record<string, unknown>>(entity: T, field: string, locale: Locale): string {
  const key = `${field}${locale === 'ar' ? 'Ar' : 'En'}`;
  const fallbackKey = `${field}${locale === 'ar' ? 'En' : 'Ar'}`;
  const v = entity[key];
  if (typeof v === 'string' && v.trim()) return v;
  const f = entity[fallbackKey];
  return typeof f === 'string' ? f : '';
}

export function localized(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return '';
  return (locale === 'ar' ? text.ar || text.en : text.en || text.ar) ?? '';
}

export function resolveLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const primary = input.split(',')[0]?.split(';')[0]?.trim().toLowerCase().split('-')[0] ?? '';
  return isLocale(primary) ? primary : DEFAULT_LOCALE;
}

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE_META[locale].intl, options).format(value);
}

/** Relative time ("منذ 3 دقائق" / "3 minutes ago"). */
export function formatRelative(date: Date, locale: Locale, now = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE_META[locale].intl, { numeric: 'auto' });
  const diff = (date.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

export type Messages = Record<string, unknown>;

/** Deep-merge locale messages over the default locale so missing keys never break rendering. */
export function withFallback(messages: Messages, fallback: Messages): Messages {
  const out: Messages = { ...fallback };
  for (const [k, v] of Object.entries(messages)) {
    const base = fallback[k];
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) && base && typeof base === 'object'
        ? withFallback(v as Messages, base as Messages)
        : v;
  }
  return out;
}

/** Collect missing keys (dot paths) of `target` relative to `reference`. Used by tests. */
export function missingKeys(reference: Messages, target: Messages, prefix = ''): string[] {
  const missing: string[] = [];
  for (const [k, v] of Object.entries(reference)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (!(k in target)) {
      missing.push(path);
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      missing.push(...missingKeys(v as Messages, (target[k] ?? {}) as Messages, path));
    }
  }
  return missing;
}
