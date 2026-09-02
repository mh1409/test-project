import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppError, ForbiddenError } from '@souq/shared';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  mfaDisableSchema,
  mfaEnableSchema,
  refreshSchema,
  registerSchema,
  requestPhoneVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyPhoneSchema,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
} from '@souq/validation';
import { CurrentUser, Public, RateLimit } from '../../../common/decorators';
import { zodBody } from '../../../common/pipes/zod-validation.pipe';
import type { AppRequest, AuthUser } from '../../../common/types/request';
import { ENV, type Env } from '../../../infra/config/config.module';
import { FeatureFlagService } from '../../../infra/feature-flags/feature-flag.service';
import { AuthService } from './auth.service';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from './cookies';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly flags: FeatureFlagService, @Inject(ENV) private readonly env: Env) {}

  @Public()
  @RateLimit({ name: 'register', limit: 10, windowSeconds: 3600 })
  @Post('register')
  @ApiOperation({ summary: 'Create an account (buyer role by default)' })
  async register(@Body(zodBody(registerSchema)) body: RegisterInput, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(body, { ip: req.ip, userAgent: req.headers['user-agent'] });
    setAuthCookies(res, this.env, result.tokens);
    return { user: result.user, ...publicTokens(result.tokens) };
  }

  @Public()
  @RateLimit({ name: 'login', limit: 10, windowSeconds: 900 })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email/password (+ optional MFA code)' })
  async login(@Body(zodBody(loginSchema)) body: LoginInput, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(body, { ip: req.ip, userAgent: req.headers['user-agent'], deviceName: body.deviceName });
    if (result.mfaRequired) return { mfaRequired: true };
    setAuthCookies(res, this.env, result.tokens);
    return { mfaRequired: false, ...publicTokens(result.tokens) };
  }

  @Public()
  @RateLimit({ name: 'refresh', limit: 60, windowSeconds: 900 })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token (cookie or body)' })
  async refresh(@Body(zodBody(refreshSchema)) body: { refreshToken?: string }, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const token = body.refreshToken ?? (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!token) throw new AppError('TOKEN_INVALID', 'Missing refresh token');
    const tokens = await this.auth.refresh(token, { ip: req.ip, userAgent: req.headers['user-agent'] });
    setAuthCookies(res, this.env, tokens);
    return publicTokens(tokens);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.sessionId);
    clearAuthCookies(res, this.env);
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.revokeAll(user.id);
    clearAuthCookies(res, this.env);
  }

  @Public()
  @RateLimit({ name: 'password-reset', limit: 5, windowSeconds: 3600 })
  @Post('forgot-password')
  @HttpCode(202)
  async forgot(@Body(zodBody(forgotPasswordSchema)) body: { email: string }) {
    await this.auth.forgotPassword(body.email);
    return { accepted: true };
  }

  @Public()
  @RateLimit({ name: 'password-reset', limit: 10, windowSeconds: 3600 })
  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body(zodBody(resetPasswordSchema)) body: { token: string; password: string }) {
    await this.auth.resetPassword(body.token, body.password);
    return { reset: true };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body(zodBody(verifyEmailSchema)) body: { token: string }) {
    await this.auth.verifyEmail(body.token);
    return { verified: true };
  }

  @ApiBearerAuth()
  @RateLimit({ name: 'resend-verification', limit: 3, windowSeconds: 600, keyBy: 'user' })
  @Post('resend-verification')
  @HttpCode(202)
  async resend(@CurrentUser() user: AuthUser) {
    await this.auth.resendVerification(user.id);
    return { accepted: true };
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(200)
  async changePassword(@CurrentUser() user: AuthUser, @Body(zodBody(changePasswordSchema)) body: ChangePasswordInput) {
    await this.auth.changePassword(user.id, body.currentPassword, body.newPassword, user.sessionId);
    return { changed: true };
  }

  @ApiBearerAuth()
  @RateLimit({ name: 'phone-verify', limit: 5, windowSeconds: 600, keyBy: 'user' })
  @Post('phone/request')
  @HttpCode(202)
  async requestPhone(@CurrentUser() user: AuthUser, @Body(zodBody(requestPhoneVerificationSchema)) body: { phone: string }) {
    await this.auth.requestPhoneVerification(user.id, body.phone);
    return { accepted: true };
  }

  @ApiBearerAuth()
  @Post('phone/verify')
  @HttpCode(200)
  async verifyPhone(@CurrentUser() user: AuthUser, @Body(zodBody(verifyPhoneSchema)) body: { code: string }) {
    await this.auth.verifyPhone(user.id, body.code);
    return { verified: true };
  }

  @ApiBearerAuth()
  @Post('mfa/setup')
  async mfaSetup(@CurrentUser() user: AuthUser) {
    return this.auth.mfaSetup(user.id);
  }

  @ApiBearerAuth()
  @Post('mfa/enable')
  async mfaEnable(@CurrentUser() user: AuthUser, @Body(zodBody(mfaEnableSchema)) body: { code: string }) {
    return this.auth.mfaEnable(user.id, body.code);
  }

  @ApiBearerAuth()
  @Post('mfa/disable')
  @HttpCode(200)
  async mfaDisable(@CurrentUser() user: AuthUser, @Body(zodBody(mfaDisableSchema)) body: { code: string; password: string }) {
    await this.auth.mfaDisable(user.id, body.code, body.password);
    return { disabled: true };
  }

  @ApiBearerAuth()
  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.id, user.sessionId);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.auth.revokeSession(user.id, id);
  }

  @ApiBearerAuth()
  @Get('login-history')
  history(@CurrentUser() user: AuthUser) {
    return this.auth.loginHistory(user.id);
  }

  /** Admin-only impersonation, behind a feature flag and audited by the admin module. */
  @ApiBearerAuth()
  @Post('impersonate/:userId')
  async impersonate(@CurrentUser() user: AuthUser, @Param('userId') userId: string, @Body() body: { minutes?: number }) {
    if (!user.permissions.includes('user:impersonate')) throw new ForbiddenError();
    if (!(await this.flags.isEnabled('impersonation', { userId: user.id, roles: user.roles }))) throw new AppError('FEATURE_DISABLED', 'Impersonation is disabled');
    return this.auth.impersonate(user.id, userId, Math.min(60, Math.max(5, body?.minutes ?? 30)));
  }
}

function publicTokens(t: { accessToken: string; refreshToken: string; expiresIn: number }) {
  return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresIn: t.expiresIn, tokenType: 'Bearer' as const };
}
