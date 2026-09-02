import { z } from 'zod';
import { emailSchema, localeSchema, passwordSchema, phoneSchema } from './common.js';

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: phoneSchema.optional(),
  locale: localeSchema.optional(),
  referralCode: z.string().trim().max(32).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  mfaCode: z.string().regex(/^\d{6}$/).optional(),
  deviceName: z.string().trim().max(100).optional(),
  remember: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(1024).optional() });

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(512), password: passwordSchema });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(512) });
export const requestPhoneVerificationSchema = z.object({ phone: phoneSchema });
export const verifyPhoneSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });
export const mfaEnableSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
export const mfaDisableSchema = z.object({ code: z.string().regex(/^\d{6}$/), password: z.string().min(1) });

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number(),
  tokenType: z.literal('Bearer'),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
