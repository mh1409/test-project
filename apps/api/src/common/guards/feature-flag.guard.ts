import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureDisabledError } from '@souq/shared';
import type { FeatureFlagKey } from '@souq/config';
import { FeatureFlagService } from '../../infra/feature-flags/feature-flag.service';
import { FEATURE_FLAG_KEY } from '../decorators';
import type { AppRequest } from '../types/request';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly flags: FeatureFlagService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flag = this.reflector.getAllAndOverride<FeatureFlagKey | undefined>(FEATURE_FLAG_KEY, [context.getHandler(), context.getClass()]);
    if (!flag) return true;
    const req = context.switchToHttp().getRequest<AppRequest>();
    const enabled = await this.flags.isEnabled(flag, { userId: req.user?.id, roles: req.user?.roles });
    if (!enabled) throw new FeatureDisabledError(flag);
    return true;
  }
}
