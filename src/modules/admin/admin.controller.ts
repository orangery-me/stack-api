import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@Constant/enums';
import { AdminService } from './admin.service';
import { SystemOverviewDto } from './dto/system-overview.dto';
import { UserGrowthDto } from './dto/user-growth.dto';
import { UserGrowthQueryDto } from './dto/stats-query.dto';

@ApiTags('admin / dashboard')
@Controller('admin/stats')
@UseGuards(JwtAccessTokenGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'System overview stats for admin dashboard' })
  async getOverview(): Promise<ResponseItem<SystemOverviewDto>> {
    const data = await this.adminService.getOverview();
    return new ResponseItem(data, 'Overview stats fetched successfully');
  }

  @Get('user-growth')
  @ApiOperation({ summary: 'User growth data for chart' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getUserGrowth(
    @Query() query: UserGrowthQueryDto,
  ): Promise<ResponseItem<UserGrowthDto>> {
    const data = await this.adminService.getUserGrowth(query);
    return new ResponseItem(data, 'User growth fetched successfully');
  }
}
