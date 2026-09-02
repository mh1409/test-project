import { Global, Module } from '@nestjs/common';
import { ENV, LOGGER, type Env, type Logger } from '../config/config.module';
import { LogMailProvider } from './log-mail.provider';
import { MAIL_PROVIDER, type MailProvider } from './mail.provider';
import { SmtpMailProvider } from './smtp-mail.provider';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_PROVIDER,
      useFactory: (env: Env, logger: Logger): MailProvider => (env.EMAIL_PROVIDER === 'smtp' && env.SMTP_URL ? new SmtpMailProvider(env.SMTP_URL, env.EMAIL_FROM) : new LogMailProvider(logger)),
      inject: [ENV, LOGGER],
    },
  ],
  exports: [MAIL_PROVIDER],
})
export class MailModule {}
