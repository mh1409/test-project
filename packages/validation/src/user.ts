import { z } from 'zod';
import { NotificationChannel, NotificationType } from '@souq/types';
import { currencySchema, localeSchema, phoneSchema, urlSchema } from './common.js';

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9_.]+$/i).optional(),
  bio: z.string().trim().max(1000).optional().nullable(),
  avatarUrl: urlSchema.optional().nullable(),
  coverUrl: urlSchema.optional().nullable(),
  phone: phoneSchema.optional(),
  locale: localeSchema.optional(),
  currency: currencySchema.optional(),
  timezone: z.string().max(64).optional(),
  birthDate: z.coerce.date().optional().nullable(),
  gender: z.enum(['male', 'female', 'unspecified']).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const privacySettingsSchema = z.object({
  profilePublic: z.boolean().optional(),
  showPurchaseHistory: z.boolean().optional(),
  allowMessagesFromAnyone: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
});

export const notificationPreferenceSchema = z.object({
  type: z.union([z.enum(Object.keys(NotificationType) as [string, ...string[]]), z.literal('*')]),
  channel: z.enum(Object.keys(NotificationChannel) as [string, ...string[]]),
  enabled: z.boolean(),
});
export const notificationPreferencesUpdateSchema = z.object({ preferences: z.array(notificationPreferenceSchema).min(1).max(200) });

export const blockUserSchema = z.object({ userId: z.string().uuid(), reason: z.string().trim().max(200).optional() });

export const deleteAccountSchema = z.object({ password: z.string().min(1), confirmation: z.literal('DELETE') });

export const pushDeviceSchema = z.object({ platform: z.enum(['web', 'ios', 'android']), token: z.string().min(10).max(4096) });
