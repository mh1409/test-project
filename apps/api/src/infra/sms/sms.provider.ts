import { Global, Module } from '@nestjs/common';
import type { Logger } from '@souq/observability';
import { maskPhone } from '@souq/shared';
import { LOGGER } from '../config/config.module';

export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<{ messageId: string }>;
}
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export class LogSmsProvider implements SmsProvider {
  readonly name = 'log';
  readonly sent: { to: string; body: string }[] = [];
  constructor(private readonly logger: Logger) {}
  async send(to: string, body: string): Promise<{ messageId: string }> {
    this.sent.push({ to, body });
    if (this.sent.length > 100) this.sent.shift();
    this.logger.info({ to: maskPhone(to) }, 'SMS (log provider)');
    return { messageId: crypto.randomUUID() };
  }
}

@Global()
@Module({ providers: [{ provide: SMS_PROVIDER, useFactory: (logger: Logger): SmsProvider => new LogSmsProvider(logger), inject: [LOGGER] }], exports: [SMS_PROVIDER] })
export class SmsModule {}
