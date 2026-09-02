import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@souq/types';
import { CacheService } from '../../../infra/cache/cache.service';
import { PrismaService, type Tx } from '../../../infra/prisma/prisma.service';

/** Roles are bundles of permissions. Effective permissions are resolved from the DB (custom roles supported). */
@Injectable()
export class RolesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService) {}

  /** Idempotently sync the permission catalog and system roles at startup. */
  async onModuleInit(): Promise<void> {
    await this.syncCatalog().catch(() => undefined);
  }

  async syncCatalog(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const key of PERMISSIONS) {
        await tx.permission.upsert({ where: { key }, update: {}, create: { key } });
      }
      const perms = await tx.permission.findMany();
      const byKey = new Map(perms.map((p) => [p.key, p.id]));
      for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
        const role = await tx.role.upsert({ where: { name }, update: {}, create: { name, isSystem: true } });
        // only add missing permissions to system roles; never remove admin-granted extras
        const existing = await tx.rolePermission.findMany({ where: { roleId: role.id }, select: { permissionId: true } });
        const have = new Set(existing.map((e) => e.permissionId));
        const toAdd = permissions.map((p) => byKey.get(p)).filter((id): id is string => !!id && !have.has(id));
        if (toAdd.length) await tx.rolePermission.createMany({ data: toAdd.map((permissionId) => ({ roleId: role.id, permissionId })), skipDuplicates: true });
      }
    });
    await this.cache.invalidateTags('roles');
  }

  async resolveForUser(userId: string, tx?: Tx): Promise<{ roles: string[]; permissions: Permission[] }> {
    const client = tx ?? this.prisma;
    const rows = await client.userRole.findMany({
      where: { userId },
      select: { role: { select: { name: true, permissions: { select: { permission: { select: { key: true } } } } } } },
    });
    const roles = rows.map((r) => r.role.name);
    const permissions = new Set<Permission>();
    for (const r of rows) for (const p of r.role.permissions) permissions.add(p.permission.key as Permission);
    return { roles, permissions: [...permissions] };
  }

  async assign(userId: string, roleName: string, assignedBy?: string, tx?: Tx): Promise<void> {
    const client = tx ?? this.prisma;
    const role = await client.role.findUniqueOrThrow({ where: { name: roleName } });
    await client.userRole.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, update: {}, create: { userId, roleId: role.id, assignedBy } });
  }

  async revoke(userId: string, roleName: string, tx?: Tx): Promise<void> {
    const client = tx ?? this.prisma;
    const role = await client.role.findUnique({ where: { name: roleName } });
    if (role) await client.userRole.deleteMany({ where: { userId, roleId: role.id } });
  }

  async listRoles() {
    return this.cache.remember(
      'roles:all',
      300,
      () =>
        this.prisma.role.findMany({
          include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
          orderBy: { name: 'asc' },
        }),
      ['roles'],
    );
  }
}
