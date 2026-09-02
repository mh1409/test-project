import { z } from 'zod';
import { SellerType } from '@souq/types';
import { addressInputSchema, emailSchema, phoneSchema, slugSchema, urlSchema } from './common.js';

export const sellerApplicationSchema = z
  .object({
    type: z.nativeEnum(SellerType),
    displayName: z.string().trim().min(2).max(100),
    contactEmail: emailSchema,
    contactPhone: phoneSchema,
    // individual
    nationalId: z.string().trim().regex(/^\d{10}$/).optional(),
    dateOfBirth: z.coerce.date().optional(),
    // business
    legalName: z.string().trim().min(2).max(200).optional(),
    commercialRegistration: z.string().trim().regex(/^\d{10}$/).optional(),
    vatNumber: z.string().trim().regex(/^\d{15}$/).optional(),
    businessAddress: addressInputSchema.omit({ recipientName: true, phone: true, isDefaultBilling: true, isDefaultShipping: true }).optional(),
    representativeName: z.string().trim().min(2).max(120).optional(),
    representativePhone: phoneSchema.optional(),
    representativeEmail: emailSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'INDIVIDUAL' && !v.nationalId) ctx.addIssue({ code: 'custom', path: ['nationalId'], message: 'Required for individual sellers' });
    if (v.type === 'BUSINESS') {
      if (!v.legalName) ctx.addIssue({ code: 'custom', path: ['legalName'], message: 'Required for business sellers' });
      if (!v.commercialRegistration) ctx.addIssue({ code: 'custom', path: ['commercialRegistration'], message: 'Required for business sellers' });
      if (!v.representativeName) ctx.addIssue({ code: 'custom', path: ['representativeName'], message: 'Required for business sellers' });
    }
  });
export type SellerApplicationInput = z.infer<typeof sellerApplicationSchema>;

export const payoutAccountSchema = z.object({
  accountHolder: z.string().trim().min(2).max(120),
  bankName: z.string().trim().min(2).max(120),
  iban: z.string().trim().toUpperCase().regex(/^SA\d{22}$|^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/, 'Invalid IBAN'),
  swift: z.string().trim().max(11).optional(),
});

export const sellerDocumentSchema = z.object({
  type: z.enum(['NATIONAL_ID', 'COMMERCIAL_REGISTRATION', 'VAT_CERT', 'BANK_LETTER', 'OTHER']),
  uploadId: z.string().uuid(),
});

export const sellerReviewDecisionSchema = z.object({
  decision: z.enum(['UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED']),
  note: z.string().trim().min(3).max(2000),
});

export const storeUpsertSchema = z.object({
  name: z.string().trim().min(2).max(100),
  nameAr: z.string().trim().min(2).max(100).optional(),
  slug: slugSchema.optional(),
  logoUrl: urlSchema.optional().nullable(),
  coverUrl: urlSchema.optional().nullable(),
  description: z.string().trim().max(4000).optional(),
  descriptionAr: z.string().trim().max(4000).optional(),
  shippingPolicy: z.string().trim().max(4000).optional(),
  returnPolicy: z.string().trim().max(4000).optional(),
  socialLinks: z.record(z.enum(['instagram', 'x', 'tiktok', 'snapchat', 'website', 'youtube']), urlSchema).optional(),
});
export type StoreUpsertInput = z.infer<typeof storeUpsertSchema>;

export const vacationModeSchema = z.object({ enabled: z.boolean(), message: z.string().trim().max(500).optional() });

export const pickupLocationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  country: z.string().length(2).toUpperCase(),
  city: z.string().trim().min(1).max(100),
  district: z.string().trim().max(100).optional(),
  street: z.string().trim().min(1).max(200),
  building: z.string().trim().max(50).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  openingHours: z.record(z.string(), z.string()).optional(),
  instructions: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export const storeAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(120),
  titleAr: z.string().trim().max(120).optional(),
  body: z.string().trim().min(2).max(2000),
  bodyAr: z.string().trim().max(2000).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

export const shippingRuleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  nameAr: z.string().trim().max(100).optional(),
  zoneId: z.string().uuid().optional().nullable(),
  serviceCode: z.enum(['standard', 'express', 'same_day']).default('standard'),
  baseAmount: z.number().int().min(0),
  perKgAmount: z.number().int().min(0).default(0),
  minWeightGrams: z.number().int().min(0).optional().nullable(),
  maxWeightGrams: z.number().int().min(0).optional().nullable(),
  minOrderTotal: z.number().int().min(0).optional().nullable(),
  maxOrderTotal: z.number().int().min(0).optional().nullable(),
  freeAbove: z.number().int().min(0).optional().nullable(),
  minDays: z.number().int().min(0).max(60).default(2),
  maxDays: z.number().int().min(0).max(90).default(5),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
