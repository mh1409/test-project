import { describe, expect, it } from 'vitest';
import { couponUpsertSchema, productUpsertSchema, registerSchema, safeRedirectSchema, sellerApplicationSchema } from './index.js';

describe('validation', () => {
  it('validates registration', () => {
    expect(registerSchema.safeParse({ email: 'A@B.com', password: 'weak', firstName: 'a', lastName: 'b', acceptTerms: true }).success).toBe(false);
    const ok = registerSchema.safeParse({ email: ' A@B.com ', password: 'Str0ngPassw0rd', firstName: 'Ali', lastName: 'Hassan', acceptTerms: true });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe('a@b.com');
  });
  it('rejects open redirects', () => {
    expect(safeRedirectSchema.safeParse('/account').success).toBe(true);
    expect(safeRedirectSchema.safeParse('//evil.com').success).toBe(false);
    expect(safeRedirectSchema.safeParse('https://evil.com').success).toBe(false);
  });
  it('validates business seller requirements', () => {
    const r = sellerApplicationSchema.safeParse({ type: 'BUSINESS', displayName: 'Shop', contactEmail: 'x@y.com', contactPhone: '0501234567' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain('legalName');
  });
  it('rejects compareAtPrice below price and auction with variants', () => {
    const base = {
      categoryId: '11111111-1111-4111-8111-111111111111',
      titleAr: 'هاتف ذكي', titleEn: 'Smartphone', descriptionAr: 'وصف طويل للمنتج', descriptionEn: 'A long product description',
      price: 100000, compareAtPrice: 90000,
    };
    const r = productUpsertSchema.safeParse(base);
    expect(r.success).toBe(false);
    const r2 = productUpsertSchema.safeParse({ ...base, compareAtPrice: 120000, listingType: 'AUCTION', options: [{ name: 'Color', values: [{ value: 'Red' }] }], variants: [{ options: { Color: 'Red' } }] });
    expect(r2.success).toBe(false);
  });
  it('uppercases coupon codes and checks percentage bounds', () => {
    const ok = couponUpsertSchema.safeParse({ code: 'welcome10', type: 'PERCENTAGE', value: 1000, startsAt: new Date() });
    expect(ok.success && ok.data.code).toBe('WELCOME10');
    expect(couponUpsertSchema.safeParse({ code: 'x100', type: 'PERCENTAGE', value: 20000, startsAt: new Date() }).success).toBe(false);
  });
});
