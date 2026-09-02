import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Validates that a session referenced by an access token is still alive and that the
 * user's tokenVersion has not been bumped (logout-all, password change, ban).
 * Results are cached briefly (60s) so revocation propagates within a minute.
 */
@Injectable()
export class SessionValidator {
  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService) {}

  async isValid(userId: string, sessionId: string, tokenVersion: number): Promise<boolean> {
    const key = `session:${sessionId}`;
    const cached = await this.cache.get<{ ok: boolean; tv: number }>(key);
    if (cached) return cached.ok && cached.tv === tokenVersion;
    const [session, user] = await Promise.all([
      this.prisma.userSession.findUnique({ where: { id: sessionId }, select: { userId: true, revokedAt: true, expiresAt: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true, status: true } }),
    ]);
    const ok = !!session && session.userId === userId && !session.revokedAt && session.expiresAt > new Date() && !!user && (user.status === 'ACTIVE' || user.status === 'PENDING_DELETION');
    const result = { ok, tv: user?.tokenVersion ?? -1 };
    await this.cache.set(key, result, ok ? 60 : 10);
    return ok && result.tv === tokenVersion;
  }

  async invalidate(sessionId: string): Promise<void> {
    await this.cache.del(`session:${sessionId}`);
  }
}
