import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { addressInputSchema, type AddressInput } from '@souq/validation';
import { CurrentUser } from '../../../common/decorators';
import { zodBody } from '../../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../../common/types/request';
import { AddressesService } from './addresses.service';

@ApiTags('addresses')
@ApiBearerAuth()
@Controller('users/me/addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.addresses.list(user.id);
  }
  @Post()
  create(@CurrentUser() user: AuthUser, @Body(zodBody(addressInputSchema)) body: AddressInput) {
    return this.addresses.create(user.id, body);
  }
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addresses.get(user.id, id);
  }
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(zodBody(addressInputSchema.partial())) body: Partial<AddressInput>) {
    return this.addresses.update(user.id, id, body);
  }
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.addresses.remove(user.id, id);
  }
}
