import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../../auth/guards/jwt-access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@Constant/enums';
import { AdminAnalyticsService } from './admin-analytics.service';

@ApiTags('admin / analytics')
@Controller('admin/analytics')
@UseGuards(JwtAccessTokenGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminAnalyticsController {
  constructor(private readonly service: AdminAnalyticsService) {}

  @Get('users')
  @ApiOperation({ summary: 'Active users analytics' })
  @ApiQuery({ name: 'days', required: false })
  async getActiveUsers(@Query('days') days?: number) {
    return new ResponseItem(await this.service.getActiveUsers(days || 30), 'Analytics fetched');
  }

  @Get('users/:id/activity')
  @ApiOperation({ summary: 'Single user activity detail' })
  async getUserActivity(@Param('id') id: string) {
    return new ResponseItem(await this.service.getUserActivity(id), 'User activity fetched');
  }

  @Get('workspaces')
  @ApiOperation({ summary: 'Workspace activity ranking' })
  async getWorkspaceActivity() {
    return new ResponseItem(await this.service.getWorkspaceActivity(), 'Workspace activity fetched');
  }
}
