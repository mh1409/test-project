import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { isUniqueViolation } from '@souq/database';
import { AppError, ConflictError, NotFoundError, UnauthenticatedError, ValidationError, addMinutes, hashPassword, normalizeEmail, normalizePhone, secureToken, sha256, slugify, verifyPassword } from '@souq/shared';
import type { LoginInput, RegisterInput } from '@souq/validation';
import type { Permission } from '@souq/types';
import { TokenService } from '../../../infra/auth/token.service';
import { SessionValidator } from '../../../infra/auth/session-validator';
import { ENV, LOGGER, type Env, type Logger } from '../../../infra/config/config.module';
import { OutboxService } from '../../../infra/events/outbox.service';
import { PrismaService, type Tx } from '../../../infra/prisma/prisma.service';
import { QueueService } from '../../../infra/queue/queue.service';
import { RolesService } from '../roles/roles.service';
import { SecretBox } from './crypto.util';

export interface RequestInfo {
  ip?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
}
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  sessionId: string;
}

@Injectable()
export class AuthService {
  private readonly secretBox: SecretBox;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly roles: RolesService,
    private readonly outbox: OutboxService,
    private readonly queue: QueueService,
    private readonly sessions: SessionValidator,
    @Inject(ENV) private readonly env: Env,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {
    this.secretBox = new SecretBox(env.JWT_REFRESH_SECRET);
  }

  // ── Registration ────────────────────────────────────────────────────────────
  async register(input: RegisterInput, info: RequestInfo): Promise<{ user: { id: string; email: string }; tokens: IssuedTokens }> {
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    const phone = input.phone ? normalizePhone(input.phone) : undefined;
    const verifyToken = secureToken(32);

    const created = await this.prisma
      .transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, passwordHash, phone, locale: input.locale ?? this.env.DEFAULT_LOCALE, currency: this.env.DEFAULT_CURRENCY, referralCodeUsed: input.referralCode ?? null },
        });
        const base = slugify(`${input.firstName}${input.lastName}`).replace(/-/g, '_').slice(0, 20) || 'user';
        let username = base;
        for (let i = 0; i < 5; i++) {
          const exists = await tx.userProfile.findUnique({ where: { username } });
          if (!exists) break;
          username = `${base}_${randomInt(1000, 9999)}`;
        }
        await tx.userProfile.create({ data: { userId: user.id, firstName: input.firstName, lastName: input.lastName, username } });
        await this.roles.assign(user.id, 'BUYER', undefined, tx);
        await tx.wishlist.create({ data: { userId: user.id, name: input.locale === 'en' ? 'My wishlist' : 'قائمتي', isDefault: true } });
        await tx.verificationToken.create({ data: { userId: user.id, type: 'EMAIL_VERIFY', tokenHash: sha256(verifyToken), expiresAt: addMinutes(new Date(), 24 * 60) } });
        if (input.referralCode) {
          const code = await tx.referralCode.findUnique({ where: { code: input.referralCode } });
          if (code && code.userId !== user.id) await tx.referral.create({ data: { codeUserId: code.userId, refereeId: user.id } });
        }
        await this.outbox.emit(tx, 'user.registered', 'User', user.id, { email, locale: user.locale, firstName: input.firstName });
        return user;
      })
      .catch((err) => {
        if (isUniqueViolation(err, 'email')) throw new ConflictError('An account with this email already exists');
        if (isUniqueViolation(err, 'phone')) throw new ConflictError('An account with this phone already exists');
        throw err;
      });

    await this.queue.enqueue('email.send', {
      to: email,
      template: 'verify-email',
      locale: (created.locale as 'ar' | 'en') ?? 'ar',
      data: { url: `${this.env.APP_URL}/${created.locale}/auth/verify-email?token=${verifyToken}` },
    });
    await this.queue.enqueue('email.send', { to: email, template: 'welcome', locale: (created.locale as 'ar' | 'en') ?? 'ar', data: { name: input.firstName, appUrl: this.env.APP_URL } });

    const tokens = await this.createSession(created.id, info);
    return { user: { id: created.id, email: created.email }, tokens };
  }

  // ── Login ───────────────────────────────────────────────────────────────────
  async login(input: LoginInput, info: RequestInfo): Promise<{ tokens: IssuedTokens; mfaRequired?: false } | { mfaRequired: true }> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const fail = async (reason: string) => {
      if (user) {
        const attempts = user.failedLoginCount + 1;
        const lock = attempts >= this.env.LOGIN_MAX_ATTEMPTS;
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: lock ? 0 : attempts, lockedUntil: lock ? addMinutes(new Date(), this.env.LOGIN_LOCK_MINUTES) : undefined },
        });
        await this.prisma.loginHistory.create({ data: { userId: user.id, success: false, reason, ipAddress: info.ip ?? null, userAgent: info.userAgent ?? null } });
        if (lock) {
          await this.queue.enqueue('email.send', {
            to: user.email,
            template: 'security-alert',
            locale: user.locale as 'ar' | 'en',
            data: { message: `Account locked for ${this.env.LOGIN_LOCK_MINUTES} minutes after repeated failed logins`, url: `${this.env.APP_URL}/${user.locale}/account/security` },
          });
          throw new AppError('ACCOUNT_LOCKED', 'Too many failed attempts', { minutes: this.env.LOGIN_LOCK_MINUTES });
        }
      } else {
        // Constant-time-ish behaviour: hash anyway to avoid user enumeration via timing
        await verifyPassword(input.password, 'scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      }
      throw new UnauthenticatedError('Invalid email or password');
    };

    if (!user) return fail('NO_USER');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('ACCOUNT_LOCKED', 'Account temporarily locked', { minutes: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000) });
    }
    if (user.status === 'BANNED' || user.status === 'DELETED') throw new AppError('FORBIDDEN', 'This account is not available');
    if (user.status === 'SUSPENDED') throw new AppError('FORBIDDEN', 'This account is suspended');
    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) return fail('BAD_PASSWORD');

    if (user.mfaEnabled) {
      if (!input.mfaCode) return { mfaRequired: true };
      const secret = user.mfaSecret ? this.secretBox.decrypt(user.mfaSecret) : null;
      if (!secret || !authenticator.check(input.mfaCode, secret)) {
        await this.prisma.loginHistory.create({ data: { userId: user.id, success: false, reason: 'BAD_MFA', ipAddress: info.ip ?? null, userAgent: info.userAgent ?? null } });
        throw new AppError('MFA_REQUIRED', 'Invalid authentication code');
      }
    }

    const newDevice = await this.isNewDevice(user.id, info);
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.prisma.loginHistory.create({ data: { userId: user.id, success: true, ipAddress: info.ip ?? null, userAgent: info.userAgent ?? null } });
    if (newDevice) {
      await this.prisma.$transaction(async (tx) => {
        await this.outbox.emit(tx, 'user.login_suspicious', 'User', user.id, { ip: info.ip, userAgent: info.userAgent, reason: 'NEW_DEVICE' });
      });
    }
    const tokens = await this.createSession(user.id, info, input.remember);
    return { tokens };
  }

  private async isNewDevice(userId: string, info: RequestInfo): Promise<boolean> {
    if (!info.userAgent && !info.ip) return false;
    const prior = await this.prisma.loginHistory.findFirst({ where: { userId, success: true, OR: [{ userAgent: info.userAgent ?? undefined }, { ipAddress: info.ip ?? undefined }] } });
    return !prior;
  }

  // ── Sessions & tokens ───────────────────────────────────────────────────────
  async createSession(userId: string, info: RequestInfo, remember = true): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { seller: { select: { id: true } } } });
    const ttl = remember ? this.tokens.refreshTtlSeconds : Math.min(this.tokens.refreshTtlSeconds, 12 * 3600);
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: sha256(secureToken(16)), // placeholder, replaced below
        deviceName: info.deviceName ?? deviceFromUa(info.userAgent),
        deviceType: deviceType(info.userAgent),
        userAgent: info.userAgent?.slice(0, 300) ?? null,
        ipAddress: info.ip ?? null,
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });
    const refreshToken = await this.tokens.signRefreshToken(session.id, userId);
    await this.prisma.userSession.update({ where: { id: session.id }, data: { refreshTokenHash: sha256(refreshToken) } });
    const accessToken = await this.issueAccess(user, session.id);
    return { accessToken, refreshToken, expiresIn: this.tokens.accessTtlSeconds, refreshExpiresIn: ttl, sessionId: session.id };
  }

  private async issueAccess(user: { id: string; email: string; tokenVersion: number; locale: string; seller: { id: string } | null }, sessionId: string, impersonatorId?: string): Promise<string> {
    const { roles, permissions } = await this.roles.resolveForUser(user.id);
    return this.tokens.signAccessToken({ sub: user.id, sid: sessionId, email: user.email, roles, perms: permissions as Permission[], sellerId: user.seller?.id ?? null, tv: user.tokenVersion, imp: impersonatorId, locale: user.locale });
  }

  /** Rotating refresh: old token is revoked; reuse of a revoked token revokes the whole family. */
  async refresh(refreshToken: string, info: RequestInfo): Promise<IssuedTokens> {
    const { sid, sub } = await this.tokens.verifyRefreshToken(refreshToken);
    const session = await this.prisma.userSession.findUnique({ where: { id: sid } });
    if (!session || session.userId !== sub) throw new AppError('TOKEN_INVALID', 'Invalid refresh token');
    if (session.revokedAt) {
      // Token reuse detected -> revoke all sessions for safety.
      this.logger.warn({ userId: sub, sessionId: sid }, 'Refresh token reuse detected; revoking all sessions');
      await this.revokeAll(sub);
      throw new AppError('TOKEN_INVALID', 'Refresh token reuse detected');
    }
    if (session.expiresAt <= new Date()) throw new AppError('TOKEN_EXPIRED', 'Refresh token expired');
    if (session.refreshTokenHash !== sha256(refreshToken)) throw new AppError('TOKEN_INVALID', 'Invalid refresh token');

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: sub }, include: { seller: { select: { id: true } } } });
    if (user.status !== 'ACTIVE' && user.status !== 'PENDING_DELETION') throw new AppError('FORBIDDEN', 'Account not active');

    const newSession = await this.prisma.$transaction(async (tx) => {
      const created = await tx.userSession.create({
        data: {
          userId: sub,
          refreshTokenHash: sha256(secureToken(16)),
          deviceName: session.deviceName,
          deviceType: session.deviceType,
          userAgent: info.userAgent?.slice(0, 300) ?? session.userAgent,
          ipAddress: info.ip ?? session.ipAddress,
          expiresAt: session.expiresAt,
        },
      });
      await tx.userSession.update({ where: { id: sid }, data: { revokedAt: new Date(), replacedById: created.id } });
      return created;
    });
    const newRefresh = await this.tokens.signRefreshToken(newSession.id, sub);
    await this.prisma.userSession.update({ where: { id: newSession.id }, data: { refreshTokenHash: sha256(newRefresh), lastUsedAt: new Date() } });
    await this.sessions.invalidate(sid);
    const accessToken = await this.issueAccess(user, newSession.id);
    return { accessToken, refreshToken: newRefresh, expiresIn: this.tokens.accessTtlSeconds, refreshExpiresIn: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000), sessionId: newSession.id };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.sessions.invalidate(sessionId);
  }

  async revokeAll(userId: string, exceptSessionId?: string): Promise<void> {
    const sessions = await this.prisma.userSession.findMany({ where: { userId, revokedAt: null }, select: { id: true } });
    await this.prisma.$transaction([
      this.prisma.userSession.updateMany({ where: { userId, revokedAt: null, id: exceptSessionId ? { not: exceptSessionId } : undefined }, data: { revokedAt: new Date() } }),
      this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: exceptSessionId ? 0 : 1 } } }),
    ]);
    await Promise.all(sessions.map((s) => this.sessions.invalidate(s.id)));
  }

  async listSessions(userId: string, currentSessionId: string) {
    const rows = await this.prisma.userSession.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: 'desc' } });
    return rows.map((s) => ({ id: s.id, deviceName: s.deviceName, deviceType: s.deviceType, ipAddress: s.ipAddress, lastUsedAt: s.lastUsedAt, createdAt: s.createdAt, current: s.id === currentSessionId }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const s = await this.prisma.userSession.findUnique({ where: { id: sessionId } });
    if (!s || s.userId !== userId) throw new NotFoundError('Session');
    await this.logout(sessionId);
  }

  async loginHistory(userId: string, limit = 30) {
    return this.prisma.loginHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, success: true, reason: true, ipAddress: true, userAgent: true, createdAt: true } });
  }

  // ── Email verification ──────────────────────────────────────────────────────
  async verifyEmail(token: string): Promise<void> {
    const record = await this.consumeToken(token, 'EMAIL_VERIFY');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
      await this.outbox.emit(tx, 'user.email_verified', 'User', record.userId, {});
    });
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return;
    const recent = await this.prisma.verificationToken.count({ where: { userId, type: 'EMAIL_VERIFY', createdAt: { gt: new Date(Date.now() - 5 * 60_000) } } });
    if (recent >= 3) throw new AppError('RATE_LIMITED', 'Please wait before requesting another email');
    const token = secureToken(32);
    await this.prisma.verificationToken.create({ data: { userId, type: 'EMAIL_VERIFY', tokenHash: sha256(token), expiresAt: addMinutes(new Date(), 24 * 60) } });
    await this.queue.enqueue('email.send', { to: user.email, template: 'verify-email', locale: user.locale as 'ar' | 'en', data: { url: `${this.env.APP_URL}/${user.locale}/auth/verify-email?token=${token}` } });
  }

  // ── Password reset ──────────────────────────────────────────────────────────
  async forgotPassword(emailRaw: string): Promise<void> {
    const email = normalizeEmail(emailRaw);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status === 'DELETED') return; // do not reveal existence
    const token = secureToken(32);
    await this.prisma.verificationToken.create({ data: { userId: user.id, type: 'PASSWORD_RESET', tokenHash: sha256(token), expiresAt: addMinutes(new Date(), 60) } });
    await this.queue.enqueue('email.send', { to: user.email, template: 'password-reset', locale: user.locale as 'ar' | 'en', data: { url: `${this.env.APP_URL}/${user.locale}/auth/reset-password?token=${token}` } });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.consumeToken(token, 'PASSWORD_RESET');
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null, tokenVersion: { increment: 1 } } }),
      this.prisma.userSession.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new ValidationError('Current password is incorrect', [{ path: 'currentPassword', message: 'Incorrect password' }]);
    if (await verifyPassword(newPassword, user.passwordHash)) throw new ValidationError('New password must differ from the current one');
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date() } }),
      this.prisma.userSession.updateMany({ where: { userId, revokedAt: null, id: { not: keepSessionId } }, data: { revokedAt: new Date() } }),
    ]);
    await this.queue.enqueue('email.send', { to: user.email, template: 'security-alert', locale: user.locale as 'ar' | 'en', data: { message: 'Your password was changed.', url: `${this.env.APP_URL}/${user.locale}/account/security` } });
  }

  // ── Phone verification ──────────────────────────────────────────────────────
  async requestPhoneVerification(userId: string, phoneRaw: string): Promise<void> {
    const phone = normalizePhone(phoneRaw);
    const taken = await this.prisma.user.findFirst({ where: { phone, id: { not: userId } } });
    if (taken) throw new ConflictError('Phone number already in use');
    const recent = await this.prisma.verificationToken.count({ where: { userId, type: 'PHONE_VERIFY', createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
    if (recent >= 3) throw new AppError('RATE_LIMITED', 'Please wait before requesting another code');
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.verificationToken.create({ data: { userId, type: 'PHONE_VERIFY', tokenHash: sha256(`${userId}:${code}`), payload: { phone }, expiresAt: addMinutes(new Date(), 10) } });
    await this.queue.enqueue('notification.dispatch', { notificationId: `sms:${userId}:${phone}:${code}` }); // handled by SMS dispatcher
  }

  async verifyPhone(userId: string, code: string): Promise<void> {
    const record = await this.prisma.verificationToken.findFirst({ where: { userId, type: 'PHONE_VERIFY', usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    if (!record) throw new AppError('TOKEN_INVALID', 'No pending verification');
    if (record.attempts >= 5) throw new AppError('TOKEN_INVALID', 'Too many attempts, request a new code');
    if (record.tokenHash !== sha256(`${userId}:${code}`)) {
      await this.prisma.verificationToken.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new AppError('TOKEN_INVALID', 'Invalid code');
    }
    const phone = (record.payload as { phone: string }).phone;
    await this.prisma.$transaction([
      this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: new Date() } }),
    ]);
  }

  // ── MFA (TOTP) ──────────────────────────────────────────────────────────────
  async mfaSetup(userId: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) throw new ConflictError('MFA is already enabled');
    const secret = authenticator.generateSecret(20);
    const otpauthUrl = authenticator.keyuri(user.email, this.env.MFA_ISSUER, secret);
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: this.secretBox.encrypt(secret) } });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrDataUrl };
  }

  async mfaEnable(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret) throw new ValidationError('Run MFA setup first');
    if (!authenticator.check(code, this.secretBox.decrypt(user.mfaSecret))) throw new ValidationError('Invalid authentication code');
    const recoveryCodes = Array.from({ length: 8 }, () => secureToken(6).slice(0, 10).toUpperCase());
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } }),
      this.prisma.verificationToken.deleteMany({ where: { userId, type: 'MFA_RECOVERY' } }),
      this.prisma.verificationToken.createMany({ data: recoveryCodes.map((c) => ({ userId, type: 'MFA_RECOVERY' as const, tokenHash: sha256(`${userId}:${c}`), expiresAt: new Date(Date.now() + 365 * 86400_000 * 5) })) }),
    ]);
    return { recoveryCodes };
  }

  async mfaDisable(userId: string, code: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(password, user.passwordHash))) throw new ValidationError('Incorrect password');
    const secret = user.mfaSecret ? this.secretBox.decrypt(user.mfaSecret) : null;
    const validTotp = secret ? authenticator.check(code, secret) : false;
    let validRecovery = false;
    if (!validTotp) {
      const rec = await this.prisma.verificationToken.findFirst({ where: { userId, type: 'MFA_RECOVERY', tokenHash: sha256(`${userId}:${code.toUpperCase()}`), usedAt: null } });
      if (rec) {
        validRecovery = true;
        await this.prisma.verificationToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
      }
    }
    if (!validTotp && !validRecovery) throw new ValidationError('Invalid authentication code');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } });
  }

  // ── Impersonation (admin) ───────────────────────────────────────────────────
  async impersonate(actorId: string, targetId: string, minutes: number): Promise<{ accessToken: string; expiresIn: number }> {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id: targetId }, include: { seller: { select: { id: true } } } });
    const targetRoles = await this.roles.resolveForUser(targetId);
    if (targetRoles.roles.some((r) => ['ADMIN', 'SUPER_ADMIN'].includes(r))) throw new AppError('FORBIDDEN', 'Cannot impersonate administrators');
    const session = await this.prisma.userSession.create({
      data: { userId: targetId, refreshTokenHash: sha256(secureToken(16)), deviceName: 'Impersonation', deviceType: 'impersonation', expiresAt: new Date(Date.now() + minutes * 60_000) },
    });
    const accessToken = await this.tokens.signAccessToken({
      sub: target.id,
      sid: session.id,
      email: target.email,
      roles: targetRoles.roles,
      perms: targetRoles.permissions.filter((p) => !p.startsWith('finance:') && !p.startsWith('user:')) as Permission[],
      sellerId: target.seller?.id ?? null,
      tv: target.tokenVersion,
      imp: actorId,
      locale: target.locale,
    });
    return { accessToken, expiresIn: Math.min(minutes * 60, this.tokens.accessTtlSeconds) };
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  private async consumeToken(token: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
    const hash = sha256(token);
    return this.prisma.$transaction(async (tx: Tx) => {
      const record = await tx.verificationToken.findUnique({ where: { tokenHash: hash } });
      if (!record || record.type !== type) throw new AppError('TOKEN_INVALID', 'Invalid or expired token');
      if (record.usedAt) throw new AppError('TOKEN_INVALID', 'Token already used');
      if (record.expiresAt <= new Date()) throw new AppError('TOKEN_EXPIRED', 'Token expired');
      await tx.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      return record;
    });
  }
}

function deviceFromUa(ua?: string | null): string | null {
  if (!ua) return null;
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/macintosh|mac os/i.test(ua)) return 'Mac';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown device';
}
function deviceType(ua?: string | null): string | null {
  if (!ua) return null;
  return /mobile|iphone|android/i.test(ua) ? 'mobile' : /ipad|tablet/i.test(ua) ? 'tablet' : 'desktop';
}
