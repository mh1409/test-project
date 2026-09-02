import { z } from 'zod';
import { SUPPORTED_CURRENCIES, SUPPORTED_LOCALES } from '@souq/types';

export const uuidSchema = z.string().uuid();
export const localeSchema = z.enum(SUPPORTED_LOCALES);
export const currencySchema = z.enum(SUPPORTED_CURRENCIES);
export const slugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, 'Invalid slug');
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9٠-٩\s-]{8,20}$/, 'Invalid phone number');
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a digit');
/** Money in minor units (integers only). */
export const minorUnitsSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const positiveMinorUnitsSchema = z.number().int().positive();
export const bpsSchema = z.number().int().min(0).max(10_000);
export const quantitySchema = z.number().int().min(1).max(999);
export const urlSchema = z.string().url().max(2048);
/** Only allow relative or same-site redirect targets to prevent open redirects. */
export const safeRedirectSchema = z
  .string()
  .max(512)
  .regex(/^\/(?!\/)[^\s]*$/, 'Redirect must be a relative path');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const cursorPaginationSchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const sortDirectionSchema = z.enum(['asc', 'desc']);

export const dateRangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((r) => !r.from || !r.to || r.from <= r.to, { message: 'from must be before to' });

export const localizedTextSchema = z.object({
  ar: z.string().trim().min(1).max(500),
  en: z.string().trim().min(1).max(500),
});

export const addressInputSchema = z.object({
  label: z.string().trim().max(50).optional(),
  recipientName: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  country: z.string().length(2).toUpperCase(),
  region: z.string().trim().max(100).optional(),
  city: z.string().trim().min(1).max(100),
  district: z.string().trim().max(100).optional(),
  street: z.string().trim().min(1).max(200),
  building: z.string().trim().max(50).optional(),
  apartment: z.string().trim().max(50).optional(),
  postalCode: z.string().trim().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().trim().max(500).optional(),
  isDefaultShipping: z.boolean().optional(),
  isDefaultBilling: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressInputSchema>;

export const idempotencyKeySchema = z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/);

export const idParamSchema = z.object({ id: uuidSchema });
export const slugParamSchema = z.object({ slug: z.string().min(1).max(160) });
