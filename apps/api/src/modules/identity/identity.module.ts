import { Module } from '@nestjs/common';
import { AddressesController } from './addresses/addresses.controller';
import { AddressesService } from './addresses/addresses.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { RolesService } from './roles/roles.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

@Module({
  controllers: [AuthController, UsersController, AddressesController],
  providers: [AuthService, UsersService, AddressesService, RolesService],
  exports: [UsersService, AddressesService, RolesService, AuthService],
})
export class IdentityModule {}
