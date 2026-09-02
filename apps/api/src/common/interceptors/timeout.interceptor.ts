import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor, RequestTimeoutException } from '@nestjs/common';
import { type Observable, throwError, timeout, catchError, TimeoutError } from 'rxjs';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly ms = 30_000) {}
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.ms),
      catchError((err) => (err instanceof TimeoutError ? throwError(() => new RequestTimeoutException()) : throwError(() => err))),
    );
  }
}
