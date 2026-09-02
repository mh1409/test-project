import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { blockUserSchema, deleteAccountSchema, notificationPreferencesUpdateSchema, privacySettingsSchema, pushDeviceSchema, updateProfileSchema, type UpdateProfileInput } from '@souq/validation';
import { CurrentUser, Public, RateLimit } from '../../../common/decorators';
import { zodBody } from '../../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../../common/types/request';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body(zodBody(updateProfileSchema)) body: UpdateProfileInput) {
    return this.users.updateProfile(user.id, body);
  }

  @Patch('me/privacy')
  privacy(@CurrentUser() user: AuthUser, @Body(zodBody(privacySettingsSchema)) body: Record<string, boolean>) {
    return this.users.updatePrivacy(user.id, body);
  }

  @Get('me/notification-preferences')
  prefs(@CurrentUser() user: AuthUser) {
    return this.users.notificationPreferences(user.id);
  }

  @Put('me/notification-preferences')
  updatePrefs(@CurrentUser() user: AuthUser, @Body(zodBody(notificationPreferencesUpdateSchema)) body: { preferences: { type: string; channel: string; enabled: boolean }[] }) {
    return this.users.updateNotificationPreferences(user.id, body.preferences);
  }

  @Get('me/blocks')
  blocks(@CurrentUser() user: AuthUser) {
    return this.users.blockedUsers(user.id);
  }

  @Post('me/blocks')
  @HttpCode(204)
  async block(@CurrentUser() user: AuthUser, @Body(zodBody(blockUserSchema)) body: { userId: string; reason?: string }) {
    await this.users.blockUser(user.id, body.userId, body.reason);
  }

  @Delete('me/blocks/:userId')
  @HttpCode(204)
  async unblock(@CurrentUser() user: AuthUser, @Param('userId') blockedId: string) {
    await this.users.unblockUser(user.id, blockedId);
  }

  @RateLimit({ name: 'account-deletion', limit: 3, windowSeconds: 3600, keyBy: 'user' })
  @Post('me/delete')
  @HttpCode(202)
  async requestDeletion(@CurrentUser() user: AuthUser, @Body(zodBody(deleteAccountSchema)) body: { password: string }) {
    await this.users.requestDeletion(user.id, body.password);
    return { accepted: true, gracePeriodDays: 30 };
  }

  @Post('me/delete/cancel')
  @HttpCode(204)
  async cancelDeletion(@CurrentUser() user: AuthUser) {
    await this.users.cancelDeletion(user.id);
  }

  @RateLimit({ name: 'data-export', limit: 2, windowSeconds: 86400, keyBy: 'user' })
  @Post('me/data-export')
  @HttpCode(202)
  requestExport(@CurrentUser() user: AuthUser) {
    return this.users.requestDataExport(user.id);
  }

  @Get('me/data-export')
  exports(@CurrentUser() user: AuthUser) {
    return this.users.dataExports(user.id);
  }

  @Post('me/push-devices')
  registerDevice(@CurrentUser() user: AuthUser, @Body(zodBody(pushDeviceSchema)) body: { platform: string; token: string }) {
    return this.users.registerPushDevice(user.id, body.platform, body.token);
  }

  @Delete('me/push-devices/:token')
  @HttpCode(204)
  async removeDevice(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    await this.users.removePushDevice(user.id, token);
  }

  @Public()
  @Get('profiles/:username')
  profile(@Param('username') username: string) {
    return this.users.publicProfile(username);
  }
}
