import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, UnauthenticatedError } from '@souq/shared';
import type { Permission } from '@souq/types';
import { ANY_PERMISSION_KEY, PERMISSIONS_KEY } from '../decorators';
import type { AppRequest } from '../types/request';

/** Permission-based authorization (roles are only bundles of permissions). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const all = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    const any = this.reflector.getAllAndOverride<Permission[] | undefined>(ANY_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!all?.length && !any?.length) return true;
    const req = context.switchToHttp().getRequest<AppRequest>();
    const user = req.user;
    if (!user) throw new UnauthenticatedError();
    const granted = new Set(user.permissions);
    if (all?.length && !all.every((p) => granted.has(p))) throw new ForbiddenError();
    if (any?.length && !any.some((p) => granted.has(p))) throw new ForbiddenError();
    return true;
  }
}
