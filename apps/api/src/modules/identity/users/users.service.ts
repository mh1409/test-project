import { Inject, Injectable } from '@nestjs/common';
import { isUniqueViolation } from '@souq/database';
import { ConflictError, NotFoundError, ValidationError, normalizePhone, verifyPassword } from '@souq/shared';
import type { UpdateProfileInput } from '@souq/validation';
import type { Prisma } from '@souq/database';
import { ENV, type Env } from '../../../infra/config/config.module';
import { OutboxService } from '../../../infra/events/outbox.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { QueueService } from '../../../infra/queue/queue.service';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly roles: RolesService, private readonly outbox: OutboxService, private readonly queue: QueueService, @Inject(ENV) private readonly env: Env) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, seller: { select: { id: true, verificationStatus: true, type: true, store: { select: { id: true, slug: true, name: true } } } }, wallet: { select: { balance: true, currency: true } } },
    });
    if (!user) throw new NotFoundError('User');
    const { roles, permissions } = await this.roles.resolveForUser(userId);
    const [unreadNotifications, cartCount] = await Promise.all([
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      this.prisma.cartItem.count({ where: { cart: { userId, status: 'ACTIVE' }, savedForLater: false } }),
    ]);
    return {
      id: user.id,
      email: user.email,
      emailVerified: !!user.emailVerifiedAt,
      phone: user.phone,
      phoneVerified: !!user.phoneVerifiedAt,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      locale: user.locale,
      currency: user.currency,
      timezone: user.timezone,
      createdAt: user.createdAt,
      roles,
      permissions,
      profile: user.profile,
      seller: user.seller,
      wallet: user.wallet ? { balance: Number(user.wallet.balance), currency: user.wallet.currency } : null,
      counts: { unreadNotifications, cartItems: cartCount },
      deletionRequestedAt: user.deletionRequestedAt,
    };
  }

  async publicProfile(username: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { username }, include: { user: { select: { id: true, createdAt: true, status: true, seller: { select: { store: { select: { slug: true, name: true, logoUrl: true } } } } } } } });
    if (!profile || !profile.profilePublic || profile.user.status !== 'ACTIVE') throw new NotFoundError('Profile');
    const reviewCount = await this.prisma.productReview.count({ where: { userId: profile.userId, status: 'PUBLISHED' } });
    return { id: profile.userId, username: profile.username, firstName: profile.firstName, avatarUrl: profile.avatarUrl, coverUrl: profile.coverUrl, bio: profile.bio, memberSince: profile.user.createdAt, store: profile.user.seller?.store ?? null, reviewCount };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const { firstName, lastName, username, bio, avatarUrl, coverUrl, birthDate, gender, phone, locale, currency, timezone } = input;
    try {
      await this.prisma.$transaction([
        this.prisma.userProfile.update({ where: { userId }, data: { firstName, lastName, username: username?.toLowerCase(), bio, avatarUrl, coverUrl, birthDate, gender } }),
        this.prisma.user.update({ where: { id: userId }, data: { locale, currency, timezone, ...(phone ? { phone: normalizePhone(phone), phoneVerifiedAt: null } : {}) } }),
      ]);
    } catch (err) {
      if (isUniqueViolation(err, 'username')) throw new ConflictError('Username is already taken');
      if (isUniqueViolation(err, 'phone')) throw new ConflictError('Phone number already in use');
      throw err;
    }
    return this.me(userId);
  }

  async updatePrivacy(userId: string, input: { profilePublic?: boolean; showPurchaseHistory?: boolean; allowMessagesFromAnyone?: boolean; marketingOptIn?: boolean }) {
    return this.prisma.userProfile.update({ where: { userId }, data: input, select: { profilePublic: true, showPurchaseHistory: true, allowMessagesFromAnyone: true, marketingOptIn: true } });
  }

  async notificationPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({ where: { userId } });
  }

  async updateNotificationPreferences(userId: string, prefs: { type: string; channel: string; enabled: boolean }[]) {
    await this.prisma.$transaction(
      prefs.map((p) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_type_channel: { userId, type: p.type, channel: p.channel as Prisma.NotificationPreferenceCreateInput['channel'] } },
          update: { enabled: p.enabled },
          create: { userId, type: p.type, channel: p.channel as Prisma.NotificationPreferenceCreateInput['channel'], enabled: p.enabled },
        }),
      ),
    );
    return this.notificationPreferences(userId);
  }

  async blockUser(userId: string, blockedId: string, reason?: string) {
    if (userId === blockedId) throw new ValidationError('You cannot block yourself');
    const target = await this.prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) throw new NotFoundError('User');
    await this.prisma.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: userId, blockedId } }, update: { reason }, create: { blockerId: userId, blockedId, reason } });
    await this.prisma.conversation.updateMany({ where: { participants: { every: { userId: { in: [userId, blockedId] } } } }, data: { isBlocked: true } });
  }

  async unblockUser(userId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({ where: { blockerId: userId, blockedId } });
    const stillBlocked = await this.prisma.userBlock.count({ where: { OR: [{ blockerId: userId, blockedId }, { blockerId: blockedId, blockedId: userId }] } });
    if (!stillBlocked) await this.prisma.conversation.updateMany({ where: { participants: { every: { userId: { in: [userId, blockedId] } } } }, data: { isBlocked: false } });
  }

  async blockedUsers(userId: string) {
    const rows = await this.prisma.userBlock.findMany({ where: { blockerId: userId }, include: { blocked: { select: { id: true, profile: { select: { username: true, firstName: true, avatarUrl: true } } } } } });
    return rows.map((r) => ({ userId: r.blockedId, reason: r.reason, createdAt: r.createdAt, profile: r.blocked.profile }));
  }

  async isBlockedBetween(a: string, b: string): Promise<boolean> {
    const n = await this.prisma.userBlock.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } });
    return n > 0;
  }

  /** GDPR/PDPL style deletion: soft mark, revoke sessions, anonymize after grace period (worker job). */
  async requestDeletion(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { seller: { select: { id: true } } } });
    if (!(await verifyPassword(password, user.passwordHash))) throw new ValidationError('Incorrect password');
    const openOrders = await this.prisma.order.count({ where: { userId, status: { in: ['PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'RETURN_REQUESTED', 'DISPUTED'] } } });
    if (openOrders > 0) throw new ConflictError('You have open orders. Deletion is possible once they are completed.');
    if (user.seller) {
      const openSellerOrders = await this.prisma.sellerOrder.count({ where: { sellerId: user.seller.id, status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED', 'RETURNED'] } } });
      if (openSellerOrders > 0) throw new ConflictError('Your store has open orders. Deletion is possible once they are completed.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: 'PENDING_DELETION', deletionRequestedAt: new Date(), tokenVersion: { increment: 1 } } }),
      this.prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  async cancelDeletion(userId: string) {
    await this.prisma.user.update({ where: { id: userId, status: 'PENDING_DELETION' }, data: { status: 'ACTIVE', deletionRequestedAt: null } });
  }

  async requestDataExport(userId: string) {
    const pending = await this.prisma.dataExportRequest.findFirst({ where: { userId, status: { in: ['PENDING', 'PROCESSING'] } } });
    if (pending) return pending;
    const req = await this.prisma.dataExportRequest.create({ data: { userId } });
    await this.queue.enqueue('data-export.generate', { requestId: req.id });
    return req;
  }

  async dataExports(userId: string) {
    return this.prisma.dataExportRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 });
  }

  async registerPushDevice(userId: string, platform: string, token: string) {
    return this.prisma.pushDevice.upsert({ where: { token }, update: { userId, platform, lastSeenAt: new Date() }, create: { userId, platform, token } });
  }

  async removePushDevice(userId: string, token: string) {
    await this.prisma.pushDevice.deleteMany({ where: { userId, token } });
  }
}
