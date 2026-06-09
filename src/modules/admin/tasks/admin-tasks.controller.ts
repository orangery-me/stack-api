import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../../auth/guards/jwt-access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@Constant/enums';
import { AdminTasksService } from './admin-tasks.service';

@ApiTags('admin / tasks')
@Controller('admin/tasks')
@UseGuards(JwtAccessTokenGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminTasksController {
  constructor(private readonly service: AdminTasksService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Task overview stats for admin' })
  async getStats() {
    return new ResponseItem(await this.service.getStats(), 'Task stats fetched');
  }

  @Get('trends')
  @ApiOperation({ summary: 'Task created trends for chart' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'] })
  async getTrends(@Query('period') period?: string) {
    return new ResponseItem(await this.service.getTrends(period as any), 'Trends fetched');
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Task timeline — metadata only, no content' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'size', required: false })
  async getTimeline(@Query('page') page?: number, @Query('size') size?: number) {
    const result = await this.service.getTimeline(page, size);
    return { data: result.data, meta: result.meta, message: 'Timeline fetched' };
  }
}
