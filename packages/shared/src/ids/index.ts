import { randomBytes, randomUUID } from 'node:crypto';

export const uuid = (): string => randomUUID();

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (no I, L, O, U)

/** Human friendly, unambiguous public code (e.g. order numbers, pickup codes). */
export function publicCode(length = 8, prefix = ''): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  }
  return prefix ? `${prefix}-${out}` : out;
}

export function orderNumber(date = new Date()): string {
  const y = date.getUTCFullYear().toString().slice(-2);
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  return `SQ${y}${m}-${publicCode(8)}`;
}

export function secureToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Random, non-guessable object key for storage. Never derive from user provided names. */
export function objectKey(scope: string, extension: string): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const safeExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `${scope}/${y}/${m}/${randomUUID()}${safeExt ? '.' + safeExt : ''}`;
}
