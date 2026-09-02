import { describe, expect, it } from 'vitest';
import { normalizeArabic, normalizePhone, slugify, toAsciiDigits } from './index.js';

describe('text', () => {
  it('slugifies latin and arabic', () => {
    expect(slugify('iPhone 15 Pro Max — 256GB')).toBe('iphone-15-pro-max-256gb');
    expect(slugify('هاتف آيفون ١٥')).toBe('هاتف-آيفون-١٥');
    expect(slugify('!!!')).toBe('item');
  });
  it('normalizes arabic', () => {
    expect(normalizeArabic('أحمد إبراهيم')).toBe('احمد ابراهيم');
    expect(normalizeArabic('مكتبة')).toBe('مكتبه');
  });
  it('converts arabic digits and phones', () => {
    expect(toAsciiDigits('٠٥٠١٢٣٤٥٦٧')).toBe('0501234567');
    expect(normalizePhone('0501234567')).toBe('+966501234567');
    expect(normalizePhone('+966 50 123 4567')).toBe('+966501234567');
    expect(normalizePhone('00966501234567')).toBe('+966501234567');
  });
});
