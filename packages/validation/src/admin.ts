import { z } from 'zod';
import { PERMISSIONS, UserStatus } from '@souq/types';
import { bpsSchema, localeSchema, paginationSchema, slugSchema, sortDirectionSchema, urlSchema, uuidSchema } from './common.js';

export const adminUserListSchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  role: z.string().max(40).optional(),
  sort: z.enum(['createdAt', 'email', 'lastLoginAt']).default('createdAt'),
  dir: sortDirectionSchema.default('desc'),
});
export const adminUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
  reason: z.string().trim().min(3).max(500),
});
export const adminAssignRolesSchema = z.object({ roles: z.array(z.string().max(40)).min(1).max(10) });
export const roleUpsertSchema = z.object({
  name: z.string().trim().min(2).max(40).regex(/^[A-Z_]+$/),
  description: z.string().trim().max(200).optional(),
  permissions: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length),
});

export const moderationDecisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'HIDE', 'SUSPEND', 'BAN', 'RESTORE', 'WARN']),
  reason: z.string().trim().min(3).max(1000),
  reportId: uuidSchema.optional(),
});
export const bulkModerationSchema = z.object({
  targetType: z.enum(['PRODUCT', 'REVIEW', 'USER', 'STORE']),
  targetIds: z.array(uuidSchema).min(1).max(100),
  action: z.enum(['APPROVE', 'REJECT', 'HIDE', 'SUSPEND', 'RESTORE']),
  reason: z.string().trim().min(3).max(1000),
});
export const reportResolveSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
  resolution: z.string().trim().max(1000).optional(),
});

export const bannerUpsertSchema = z.object({
  titleAr: z.string().trim().min(1).max(120),
  titleEn: z.string().trim().min(1).max(120),
  subtitleAr: z.string().trim().max(200).optional(),
  subtitleEn: z.string().trim().max(200).optional(),
  imageUrl: urlSchema,
  mobileImageUrl: urlSchema.optional().nullable(),
  linkUrl: z.string().max(1024).optional().nullable(),
  position: z.enum(['HERO', 'SIDEBAR', 'CATEGORY', 'CHECKOUT']).default('HERO'),
  locale: localeSchema.optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const homeSectionUpsertSchema = z.object({
  type: z.enum([
    'HERO_BANNERS',
    'FEATURED_CATEGORIES',
    'TRENDING_PRODUCTS',
    'RECOMMENDED_PRODUCTS',
    'RECENTLY_VIEWED',
    'BEST_SELLERS',
    'NEW_ARRIVALS',
    'FLASH_DEALS',
    'POPULAR_SELLERS',
    'NEAR_YOU',
    'CONTINUE_SHOPPING',
    'AUCTIONS_ENDING_SOON',
  ]),
  titleAr: z.string().trim().min(1).max(100),
  titleEn: z.string().trim().min(1).max(100),
  config: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export const homeSectionsReorderSchema = z.object({ ids: z.array(uuidSchema).min(1).max(50) });

export const cmsPageUpsertSchema = z.object({
  slug: slugSchema,
  titleAr: z.string().trim().min(1).max(150),
  titleEn: z.string().trim().min(1).max(150),
  bodyAr: z.string().min(1).max(200_000),
  bodyEn: z.string().min(1).max(200_000),
  isPublished: z.boolean().default(true),
  seoDescriptionAr: z.string().trim().max(300).optional(),
  seoDescriptionEn: z.string().trim().max(300).optional(),
});
export const faqCategoryUpsertSchema = z.object({ slug: slugSchema, nameAr: z.string().trim().min(1).max(100), nameEn: z.string().trim().min(1).max(100), position: z.number().int().min(0).default(0) });
export const faqArticleUpsertSchema = z.object({
  categoryId: uuidSchema,
  slug: slugSchema,
  questionAr: z.string().trim().min(3).max(300),
  questionEn: z.string().trim().min(3).max(300),
  answerAr: z.string().min(3).max(20000),
  answerEn: z.string().min(3).max(20000),
  position: z.number().int().min(0).default(0),
  isPublished: z.boolean().default(true),
});

export const commissionRuleUpsertSchema = z.object({
  name: z.string().trim().min(2).max(100),
  bps: bpsSchema,
  priority: z.number().int().min(0).max(1000).default(0),
  sellerId: uuidSchema.optional().nullable(),
  categoryId: uuidSchema.optional().nullable(),
  productId: uuidSchema.optional().nullable(),
  campaignCode: z.string().trim().max(40).optional().nullable(),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
});
export const taxRateUpsertSchema = z.object({
  country: z.string().length(2).toUpperCase(),
  region: z.string().trim().max(100).optional().nullable(),
  name: z.string().trim().min(1).max(100),
  rateBps: bpsSchema,
  isInclusive: z.boolean().default(true),
  appliesTo: z.enum(['ALL', 'PHYSICAL', 'DIGITAL', 'SERVICE']).default('ALL'),
  isActive: z.boolean().default(true),
});
export const featureFlagUpdateSchema = z.object({
  enabled: z.boolean(),
  description: z.string().trim().max(300).optional(),
  rules: z.object({ rolloutPercent: z.number().int().min(0).max(100).optional(), allowUserIds: z.array(uuidSchema).max(1000).optional(), allowRoles: z.array(z.string()).max(20).optional() }).optional().nullable(),
});
export const systemSettingUpdateSchema = z.object({ value: z.unknown(), description: z.string().trim().max(300).optional(), isPublic: z.boolean().optional() });
export const auditLogListSchema = paginationSchema.extend({
  actorId: uuidSchema.optional(),
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(80).optional(),
  action: z.string().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export const payoutRunSchema = z.object({ sellerId: uuidSchema.optional(), idempotencyKey: z.string().min(8).max(128) });
export const financeAdjustmentSchema = z.object({
  sellerId: uuidSchema,
  amount: z.number().int().refine((n) => n !== 0, 'amount cannot be 0'),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().min(8).max(128),
});
export const analyticsRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
});
export const broadcastNotificationSchema = z.object({
  audience: z.enum(['ALL', 'BUYERS', 'SELLERS']),
  titleAr: z.string().trim().min(1).max(120),
  titleEn: z.string().trim().min(1).max(120),
  bodyAr: z.string().trim().min(1).max(1000),
  bodyEn: z.string().trim().min(1).max(1000),
  link: z.string().max(512).optional(),
});
export const impersonateSchema = z.object({ targetUserId: uuidSchema, reason: z.string().trim().min(10).max(500), minutes: z.number().int().min(5).max(60).default(30) });
