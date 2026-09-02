export const SUPPORTED_LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';
export const RTL_LOCALES: readonly Locale[] = ['ar'];
export const isRtl = (locale: string): boolean => (RTL_LOCALES as readonly string[]).includes(locale);
export const isLocale = (v: string): v is Locale => (SUPPORTED_LOCALES as readonly string[]).includes(v);

export const SUPPORTED_CURRENCIES = ['SAR', 'AED', 'USD', 'KWD', 'BHD', 'OMR', 'EGP'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'SAR';

/** Localized string pair. Fallback logic lives in packages/i18n. */
export interface LocalizedText {
  ar: string;
  en: string;
}
