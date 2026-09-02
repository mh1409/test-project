import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable, tap } from 'rxjs';
import { AUDIT_KEY, type AuditOptions } from '../../common/decorators';
import type { AppRequest } from '../../common/types/request';
import { AuditService } from './audit.service';

/** Records admin/staff actions on handlers decorated with @Audited. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opts = this.reflector.get<AuditOptions | undefined>(AUDIT_KEY, context.getHandler());
    if (!opts || context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AppRequest>();
    return next.handle().pipe(
      tap((result) => {
        const entityId = (req.params as Record<string, string>)[opts.idParam ?? 'id'] ?? (result as { id?: string } | undefined)?.id ?? null;
        void this.audit
          .record({
            actorId: req.user?.id ?? null,
            actorType: req.user?.impersonatorId ? 'IMPERSONATION' : 'USER',
            action: opts.action,
            entityType: opts.entityType,
            entityId,
            after: req.body,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            metadata: req.user?.impersonatorId ? { impersonatorId: req.user.impersonatorId } : undefined,
          })
          .catch(() => undefined);
      }),
    );
  }
}
