import { Global, Module } from '@nestjs/common';
import { SessionValidator } from './session-validator';
import { TokenService } from './token.service';

@Global()
@Module({ providers: [TokenService, SessionValidator], exports: [TokenService, SessionValidator] })
export class AuthInfraModule {}
