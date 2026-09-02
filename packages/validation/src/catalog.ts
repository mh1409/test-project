import { z } from 'zod';
import { AttributeType, ListingType, ProductCondition, ProductStatus, ProductType } from '@souq/types';
import { bpsSchema, minorUnitsSchema, paginationSchema, slugSchema, sortDirectionSchema, urlSchema, uuidSchema } from './common.js';

export const categoryUpsertSchema = z.object({
  parentId: uuidSchema.optional().nullable(),
  slug: slugSchema,
  nameAr: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().min(1).max(100),
  descriptionAr: z.string().trim().max(2000).optional(),
  descriptionEn: z.string().trim().max(2000).optional(),
  imageUrl: urlSchema.optional().nullable(),
  icon: z.string().trim().max(50).optional().nullable(),
  position: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  commissionBps: bpsSchema.optional().nullable(),
  seoTitleAr: z.string().trim().max(120).optional(),
  seoTitleEn: z.string().trim().max(120).optional(),
  seoDescriptionAr: z.string().trim().max(300).optional(),
  seoDescriptionEn: z.string().trim().max(300).optional(),
  attributeIds: z.array(uuidSchema).max(100).optional(),
});
export type CategoryUpsertInput = z.infer<typeof categoryUpsertSchema>;

export const brandUpsertSchema = z.object({
  slug: slugSchema,
  nameAr: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().min(1).max(100),
  logoUrl: urlSchema.optional().nullable(),
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export const attributeOptionSchema = z.object({
  value: z.string().trim().min(1).max(100),
  labelAr: z.string().trim().min(1).max(100),
  labelEn: z.string().trim().min(1).max(100),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).optional(),
});

export const attributeUpsertSchema = z.object({
  key: z.string().trim().min(1).max(60).regex(/^[a-z][a-z0-9_]*$/),
  nameAr: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().min(1).max(100),
  type: z.nativeEnum(AttributeType),
  unit: z.string().trim().max(20).optional().nullable(),
  isFilterable: z.boolean().optional(),
  isVariantAxis: z.boolean().optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      maxLength: z.number().int().positive().optional(),
      pattern: z.string().max(200).optional(),
    })
    .optional()
    .nullable(),
  options: z.array(attributeOptionSchema).max(500).optional(),
  position: z.number().int().min(0).optional(),
});

/** Attribute value payload; validated dynamically against the attribute definition server-side. */
export const attributeValueInputSchema = z.object({
  attributeId: uuidSchema,
  value: z.union([z.string().max(500), z.number(), z.boolean(), z.array(z.string().max(100)).max(50), z.object({ min: z.number(), max: z.number() })]),
});

export const productOptionSchema = z.object({
  name: z.string().trim().min(1).max(40),
  nameAr: z.string().trim().max(40).optional(),
  values: z
    .array(
      z.object({
        value: z.string().trim().min(1).max(60),
        valueAr: z.string().trim().max(60).optional(),
        colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      }),
    )
    .min(1)
    .max(30),
});

export const productVariantInputSchema = z.object({
  id: uuidSchema.optional(),
  sku: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/).optional(),
  barcode: z.string().trim().max(64).optional().nullable(),
  options: z.record(z.string().max(40), z.string().max(60)),
  price: minorUnitsSchema.optional().nullable(),
  compareAtPrice: minorUnitsSchema.optional().nullable(),
  weightGrams: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  imageId: uuidSchema.optional().nullable(),
  isActive: z.boolean().optional(),
});

export const productMediaInputSchema = z.object({
  uploadId: uuidSchema.optional(),
  url: urlSchema.optional(),
  type: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']).default('IMAGE'),
  altAr: z.string().trim().max(150).optional(),
  altEn: z.string().trim().max(150).optional(),
  position: z.number().int().min(0).optional(),
  isPrimary: z.boolean().optional(),
});

export const productUpsertSchema = z
  .object({
    categoryId: uuidSchema,
    brandId: uuidSchema.optional().nullable(),
    storeCategoryId: uuidSchema.optional().nullable(),
    titleAr: z.string().trim().min(3).max(200),
    titleEn: z.string().trim().min(3).max(200),
    descriptionAr: z.string().trim().min(10).max(20000),
    descriptionEn: z.string().trim().min(10).max(20000),
    shortDescriptionAr: z.string().trim().max(500).optional(),
    shortDescriptionEn: z.string().trim().max(500).optional(),
    sellerSku: z.string().trim().max(64).optional().nullable(),
    barcode: z.string().trim().max(64).optional().nullable(),
    type: z.nativeEnum(ProductType).default('PHYSICAL'),
    listingType: z.nativeEnum(ListingType).default('FIXED_PRICE'),
    condition: z.nativeEnum(ProductCondition).default('NEW'),
    conditionNotes: z.string().trim().max(1000).optional(),
    price: minorUnitsSchema,
    compareAtPrice: minorUnitsSchema.optional().nullable(),
    cost: minorUnitsSchema.optional().nullable(),
    currency: z.string().length(3).default('SAR'),
    stock: z.number().int().min(0).max(1_000_000).default(0),
    lowStockThreshold: z.number().int().min(0).default(5),
    weightGrams: z.number().int().min(0).optional().nullable(),
    lengthMm: z.number().int().min(0).optional().nullable(),
    widthMm: z.number().int().min(0).optional().nullable(),
    heightMm: z.number().int().min(0).optional().nullable(),
    countryOfOrigin: z.string().length(2).toUpperCase().optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
    searchKeywords: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    warrantyMonths: z.number().int().min(0).max(120).optional().nullable(),
    warrantyNotes: z.string().trim().max(500).optional(),
    isReturnable: z.boolean().default(true),
    returnWindowDays: z.number().int().min(0).max(90).default(14),
    allowsShipping: z.boolean().default(true),
    allowsPickup: z.boolean().default(false),
    locationCity: z.string().trim().max(100).optional().nullable(),
    locationRegion: z.string().trim().max(100).optional().nullable(),
    seoTitleAr: z.string().trim().max(120).optional(),
    seoTitleEn: z.string().trim().max(120).optional(),
    seoDescriptionAr: z.string().trim().max(300).optional(),
    seoDescriptionEn: z.string().trim().max(300).optional(),
    attributes: z.array(attributeValueInputSchema).max(100).default([]),
    options: z.array(productOptionSchema).max(3).default([]),
    variants: z.array(productVariantInputSchema).max(200).default([]),
    media: z.array(productMediaInputSchema).max(20).default([]),
    auction: z
      .object({
        startingPrice: minorUnitsSchema,
        reservePrice: minorUnitsSchema.optional().nullable(),
        bidIncrement: z.number().int().positive(),
        buyNowPrice: minorUnitsSchema.optional().nullable(),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date(),
      })
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.compareAtPrice != null && v.compareAtPrice < v.price) {
      ctx.addIssue({ code: 'custom', path: ['compareAtPrice'], message: 'Compare-at price must be >= price' });
    }
    if (!v.allowsShipping && !v.allowsPickup && v.type === 'PHYSICAL') {
      ctx.addIssue({ code: 'custom', path: ['allowsShipping'], message: 'Physical products need shipping or pickup' });
    }
    if (v.listingType === 'AUCTION') {
      if (!v.auction) ctx.addIssue({ code: 'custom', path: ['auction'], message: 'Auction settings are required' });
      else if (v.auction.endsAt <= v.auction.startsAt) ctx.addIssue({ code: 'custom', path: ['auction', 'endsAt'], message: 'endsAt must be after startsAt' });
      if (v.options.length > 0) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Auction products cannot have variants' });
    }
    if (v.options.length > 0 && v.variants.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Provide at least one variant when options are defined' });
    }
    const combos = v.options.reduce((acc, o) => acc * o.values.length, 1);
    if (combos > 200) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Too many option combinations (max 200)' });
  });
export type ProductUpsertInput = z.infer<typeof productUpsertSchema>;

export const productStatusChangeSchema = z.object({ status: z.enum(['ACTIVE', 'HIDDEN', 'ARCHIVED', 'PENDING_REVIEW']) });

export const productBulkActionSchema = z.object({
  productIds: z.array(uuidSchema).min(1).max(200),
  action: z.enum(['ACTIVATE', 'DEACTIVATE', 'ARCHIVE', 'UPDATE_STOCK', 'UPDATE_PRICE']),
  value: z.number().int().min(0).optional(),
  mode: z.enum(['SET', 'INCREMENT', 'PERCENT']).optional(),
});

export const productSearchSchema = paginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  category: z.string().max(160).optional(),
  brand: z.union([z.string().max(160), z.array(z.string().max(160))]).optional(),
  condition: z.union([z.nativeEnum(ProductCondition), z.array(z.nativeEnum(ProductCondition))]).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  seller: z.string().max(160).optional(),
  city: z.string().max(100).optional(),
  inStock: z.coerce.boolean().optional(),
  freeShipping: z.coerce.boolean().optional(),
  pickup: z.coerce.boolean().optional(),
  listingType: z.nativeEnum(ListingType).optional(),
  type: z.nativeEnum(ProductType).optional(),
  attrs: z.record(z.string().max(60), z.union([z.string().max(100), z.array(z.string().max(100))])).optional(),
  sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'best_selling', 'most_reviewed', 'top_rated', 'ending_soon']).default('relevance'),
});
export type ProductSearchInput = z.infer<typeof productSearchSchema>;

export const sellerProductListSchema = paginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  categoryId: uuidSchema.optional(),
  lowStock: z.coerce.boolean().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'price', 'salesCount', 'titleEn']).default('createdAt'),
  dir: sortDirectionSchema.default('desc'),
});

export const inventoryAdjustSchema = z.object({
  variantId: uuidSchema,
  type: z.enum(['RECEIVE', 'DAMAGE', 'ADJUST']),
  quantity: z.number().int().refine((n) => n !== 0, 'quantity cannot be 0'),
  note: z.string().trim().max(500).optional(),
});

export const productQuestionSchema = z.object({ body: z.string().trim().min(5).max(1000) });
export const productAnswerSchema = z.object({ body: z.string().trim().min(2).max(2000) });
export const answerVoteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1)]) });

export const csvImportRowSchema = z.object({
  title_ar: z.string().min(3).max(200),
  title_en: z.string().min(3).max(200),
  description_ar: z.string().min(10).max(20000),
  description_en: z.string().min(10).max(20000),
  category_slug: z.string().min(1),
  brand_slug: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  compare_at_price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().or(z.literal('')),
  stock: z.string().regex(/^\d+$/),
  sku: z.string().max(64).optional().or(z.literal('')),
  condition: z.nativeEnum(ProductCondition).optional().or(z.literal('')),
  weight_grams: z.string().regex(/^\d*$/).optional().or(z.literal('')),
  tags: z.string().max(500).optional().or(z.literal('')),
  image_urls: z.string().max(4000).optional().or(z.literal('')),
});
export type CsvImportRow = z.infer<typeof csvImportRowSchema>;
