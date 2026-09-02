/** Slugify supporting Arabic (keeps Arabic letters) and Latin. */
export function slugify(input: string, maxLength = 80): string {
  const s = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Latin diacritics (Arabic madda/hamza marks are outside this range)
    .normalize('NFC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // Arabic tashkeel + tatweel
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return s || 'item';
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…';
}

/** Normalize Arabic text for search: unify alef/yaa/taa marbuta forms and strip tashkeel. */
export function normalizeArabic(input: string): string {
  return input
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

export function isArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

/** Convert Arabic-Indic digits to ASCII digits (useful for phone/price input). */
export function toAsciiDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  const digits = toAsciiDigits(phone).replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  if (digits.startsWith('05') && digits.length === 10) return '+966' + digits.slice(1);
  if (digits.startsWith('5') && digits.length === 9) return '+966' + digits;
  return digits.startsWith('+') ? digits : '+' + digits;
}
