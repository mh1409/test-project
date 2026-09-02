import { describe, expect, it } from 'vitest';
import { missingKeys, pickLocalized, resolveLocale, withFallback } from './index.js';
import ar from './messages/ar.json';
import en from './messages/en.json';

describe('i18n', () => {
  it('resolves locale from Accept-Language', () => {
    expect(resolveLocale('en-US,en;q=0.9')).toBe('en');
    expect(resolveLocale('ar-SA')).toBe('ar');
    expect(resolveLocale('fr')).toBe('ar');
    expect(resolveLocale(null)).toBe('ar');
  });
  it('picks localized fields with fallback', () => {
    expect(pickLocalized({ titleAr: 'هاتف', titleEn: 'Phone' }, 'title', 'ar')).toBe('هاتف');
    expect(pickLocalized({ titleAr: '', titleEn: 'Phone' }, 'title', 'ar')).toBe('Phone');
  });
  it('merges fallbacks', () => {
    const out = withFallback({ a: { b: 'x' } }, { a: { b: 'y', c: 'z' }, d: 'w' }) as Record<string, unknown>;
    expect(out).toEqual({ a: { b: 'x', c: 'z' }, d: 'w' });
  });
  it('ar and en message catalogs have identical key sets', () => {
    expect(missingKeys(en, ar)).toEqual([]);
    expect(missingKeys(ar, en)).toEqual([]);
  });
});
