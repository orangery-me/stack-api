import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/list-notifications.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAccessTokenGuard)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List notifications for current user' })
  @ApiQuery({ name: 'workspaceId', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  async list(@Req() request, @Query() query: ListNotificationsQueryDto): Promise<ResponseItem<any>> {
    const data = await this.notificationsService.listForUser(
      request.user.userId,
      query.workspaceId,
      query.page,
      query.size
    );
    return new ResponseItem(data, 'Notifications fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('unread-count')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiQuery({ name: 'workspaceId', required: false })
  async unreadCount(@Req() request, @Query('workspaceId') workspaceId?: string): Promise<ResponseItem<any>> {
    const data = await this.notificationsService.getUnreadCount(request.user.userId, workspaceId);
    return new ResponseItem(data, 'Unread count fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Patch(':id/read')
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'Notification recipient id' })
  async markRead(@Req() request, @Param('id') id: string): Promise<ResponseItem<{ message: string }>> {
    await this.notificationsService.markRead(request.user.userId, id);
    return new ResponseItem({ message: 'Marked as read' }, 'Notification marked as read');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Patch('read-all')
  @ApiBearerAuth('JWT-auth')
  async markReadAll(
    @Req() request,
    @Query('workspaceId') workspaceId?: string
  ): Promise<ResponseItem<{ message: string }>> {
    await this.notificationsService.markReadAll(request.user.userId, workspaceId);
    return new ResponseItem({ message: 'All notifications marked as read' }, 'Notifications marked as read');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Patch(':id/seen')
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', description: 'Notification recipient id' })
  async markSeen(@Req() request, @Param('id') id: string): Promise<ResponseItem<{ message: string }>> {
    await this.notificationsService.markSeen(request.user.userId, id);
    return new ResponseItem({ message: 'Marked as seen' }, 'Notification marked as seen');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('preferences')
  @ApiBearerAuth('JWT-auth')
  async getPreferences(@Req() request): Promise<ResponseItem<UpdateNotificationPreferencesDto>> {
    const data = this.notificationsService.getPreferences(request.user.userId);
    return new ResponseItem(data, 'Notification preferences fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Patch('preferences')
  @ApiBearerAuth('JWT-auth')
  async updatePreferences(
    @Req() request,
    @Body() dto: UpdateNotificationPreferencesDto
  ): Promise<ResponseItem<UpdateNotificationPreferencesDto>> {
    const data = this.notificationsService.updatePreferences(request.user.userId, dto);
    return new ResponseItem(data, 'Notification preferences updated successfully');
  }
}
