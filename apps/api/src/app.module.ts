import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppExceptionFilter } from './common/filters/app-exception.filter';
import { FeatureFlagGuard } from './common/guards/feature-flag.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { AuditInterceptor } from './infra/audit/audit.interceptor';
import { IdempotencyInterceptor } from './infra/idempotency/idempotency.interceptor';
import { InfraModule } from './infra/infra.module';
import { DomainModules } from './modules';

@Module({
  imports: [InfraModule, ...DomainModules],
  providers: [
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    // Guard order matters: rate limit -> auth -> permissions -> feature flags
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: FeatureFlagGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useValue: new TimeoutInterceptor(30_000) },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*splat}');
  }
}
