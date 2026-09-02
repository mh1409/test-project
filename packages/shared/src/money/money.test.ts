import { describe, expect, it } from 'vitest';
import { Money, allocate, fromDecimalString, percentage, roundHalfEven, toDecimalString } from './index.js';

describe('Money', () => {
  it('adds and subtracts in minor units', () => {
    expect(Money.add(Money.of(1999), Money.of(1)).amount).toBe(2000);
    expect(Money.subtract(Money.of(1000), Money.of(1)).amount).toBe(999);
  });
  it('rejects currency mismatch', () => {
    expect(() => Money.add(Money.of(1, 'SAR'), Money.of(1, 'USD'))).toThrow(/mismatch/);
  });
  it('rejects non-integers', () => {
    expect(() => Money.of(10.5)).toThrow();
  });
  it('calculates VAT 15% with half-even rounding', () => {
    expect(percentage(Money.of(10001), 1500).amount).toBe(1500); // 1500.15 -> 1500
    expect(percentage(Money.of(10), 1500).amount).toBe(2); // 1.5 -> 2 (even)
    expect(percentage(Money.of(30), 1500).amount).toBe(4); // 4.5 -> 4 (even)
  });
  it('allocates without losing minor units', () => {
    const parts = allocate(Money.of(100), [1, 1, 1]);
    expect(parts.map((p) => p.amount)).toEqual([34, 33, 33]);
    expect(parts.reduce((a, p) => a + p.amount, 0)).toBe(100);
    const parts2 = allocate(Money.of(1001), [3, 7]);
    expect(parts2.reduce((a, p) => a + p.amount, 0)).toBe(1001);
  });
  it('parses decimal strings without floats', () => {
    expect(fromDecimalString('199.99').amount).toBe(19999);
    expect(fromDecimalString('0.1').amount).toBe(10);
    expect(fromDecimalString('5', 'KWD').amount).toBe(5000);
    expect(() => fromDecimalString('1.999')).toThrow();
    expect(fromDecimalString('1.990').amount).toBe(199);
  });
  it('formats decimal strings', () => {
    expect(toDecimalString(Money.of(19999))).toBe('199.99');
    expect(toDecimalString(Money.of(5))).toBe('0.05');
    expect(toDecimalString(Money.of(-5))).toBe('-0.05');
    expect(toDecimalString(Money.of(1500, 'KWD'))).toBe('1.500');
  });
  it('rounds half to even', () => {
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(3.5)).toBe(4);
    expect(roundHalfEven(2.4)).toBe(2);
    expect(roundHalfEven(2.6)).toBe(3);
  });
  it('formats for locales', () => {
    const s = Money.format(Money.of(19999), 'en-US');
    expect(s).toContain('199.99');
  });
});
