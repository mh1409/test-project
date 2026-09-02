/**
 * Money is always represented in MINOR units (e.g. halalas for SAR, cents for USD)
 * as integers. Floating point is never used for monetary computation.
 */
export const CURRENCY_MINOR_DIGITS: Record<string, number> = {
  SAR: 2,
  AED: 2,
  USD: 2,
  EUR: 2,
  EGP: 2,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JOD: 3,
  JPY: 0,
};

export const DEFAULT_CURRENCY = 'SAR';

export type CurrencyCode = keyof typeof CURRENCY_MINOR_DIGITS | string;

export interface Money {
  /** integer amount in minor units */
  readonly amount: number;
  readonly currency: string;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

function assertInteger(n: number, label = 'amount'): void {
  if (!Number.isSafeInteger(n)) {
    throw new MoneyError(`${label} must be a safe integer in minor units, got ${n}`);
  }
}

export function minorDigits(currency: string): number {
  return CURRENCY_MINOR_DIGITS[currency.toUpperCase()] ?? 2;
}

export function money(amount: number, currency: string = DEFAULT_CURRENCY): Money {
  assertInteger(amount);
  return { amount, currency: currency.toUpperCase() };
}

export const zero = (currency: string = DEFAULT_CURRENCY): Money => money(0, currency);

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function multiply(a: Money, factor: number): Money {
  if (!Number.isFinite(factor)) throw new MoneyError('factor must be finite');
  return money(roundHalfEven(a.amount * factor), a.currency);
}

export function sum(items: readonly Money[], currency: string = DEFAULT_CURRENCY): Money {
  return items.reduce((acc, m) => add(acc, m), zero(items[0]?.currency ?? currency));
}

export function isZero(a: Money): boolean {
  return a.amount === 0;
}
export function isNegative(a: Money): boolean {
  return a.amount < 0;
}
export function isPositive(a: Money): boolean {
  return a.amount > 0;
}
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  return a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0;
}
export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount === b.amount;
}
export function max(a: Money, b: Money): Money {
  return compare(a, b) >= 0 ? a : b;
}
export function min(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b;
}

/** Banker's rounding (round half to even) to avoid systematic bias. */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (Math.abs(diff - 0.5) < Number.EPSILON) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(value);
}

/**
 * Basis points are used for percentages (1 bp = 0.01%). 1500 bps = 15%.
 * Result is rounded half-even to the minor unit.
 */
export function percentage(a: Money, basisPoints: number): Money {
  assertInteger(basisPoints, 'basisPoints');
  return money(roundHalfEven((a.amount * basisPoints) / 10_000), a.currency);
}

/**
 * Allocate money proportionally across weights with no lost minor units.
 * Largest-remainder method: the remainder minor units go to the largest fractional parts.
 */
export function allocate(total: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) {
    // even split
    return allocate(total, weights.map(() => 1));
  }
  const raw = weights.map((w) => (total.amount * w) / weightSum);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = total.amount - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    remainder -= 1;
  }
  return floors.map((f) => money(f, total.currency));
}

/** Convert a decimal string like "199.99" into minor units safely (no floats). */
export function fromDecimalString(value: string, currency: string = DEFAULT_CURRENCY): Money {
  const digits = minorDigits(currency);
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) throw new MoneyError(`Invalid decimal amount: ${value}`);
  const negative = trimmed.startsWith('-');
  const [intPart, fracPart = ''] = trimmed.replace('-', '').split('.') as [string, string?];
  const frac = (fracPart ?? '').padEnd(digits, '0');
  if (frac.length > digits) {
    // more precision than the currency supports -> reject to avoid silent loss
    if (/[1-9]/.test(frac.slice(digits))) {
      throw new MoneyError(`Amount ${value} has more precision than ${currency} supports`);
    }
  }
  const amount = Number.parseInt(intPart + frac.slice(0, digits), 10) * (negative ? -1 : 1);
  return money(amount, currency);
}

/** Convert a major-unit number (e.g. from a UI form) into minor units. */
export function fromMajor(value: number, currency: string = DEFAULT_CURRENCY): Money {
  if (!Number.isFinite(value)) throw new MoneyError('value must be finite');
  const factor = 10 ** minorDigits(currency);
  return money(roundHalfEven(value * factor), currency);
}

export function toMajor(m: Money): number {
  return m.amount / 10 ** minorDigits(m.currency);
}

export function toDecimalString(m: Money): string {
  const digits = minorDigits(m.currency);
  const abs = Math.abs(m.amount).toString().padStart(digits + 1, '0');
  const intPart = digits === 0 ? abs : abs.slice(0, -digits);
  const frac = digits === 0 ? '' : '.' + abs.slice(-digits);
  return `${m.amount < 0 ? '-' : ''}${intPart}${frac}`;
}

/** Locale aware formatting. Arabic locales use Arabic currency names. */
export function formatMoney(
  m: Money,
  locale: string = 'ar-SA',
  options: { numberingSystem?: 'latn' | 'arab' } = {},
): string {
  const digits = minorDigits(m.currency);
  const formatter = new Intl.NumberFormat(
    options.numberingSystem ? `${locale}-u-nu-${options.numberingSystem}` : locale,
    {
      style: 'currency',
      currency: m.currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    },
  );
  return formatter.format(toMajor(m));
}

export const Money = {
  of: money,
  zero,
  add,
  subtract,
  multiply,
  sum,
  percentage,
  allocate,
  compare,
  equals,
  isZero,
  isNegative,
  isPositive,
  max,
  min,
  fromDecimalString,
  fromMajor,
  toMajor,
  toDecimalString,
  format: formatMoney,
};
