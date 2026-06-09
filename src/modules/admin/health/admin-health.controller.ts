import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../../auth/guards/jwt-access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@Constant/enums';
import { AdminHealthService } from './admin-health.service';

@ApiTags('admin / health')
@Controller('admin/health')
@UseGuards(JwtAccessTokenGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminHealthController {
  constructor(private readonly service: AdminHealthService) {}

  @Get()
  @ApiOperation({ summary: 'System health check' })
  async getHealth() {
    return new ResponseItem(await this.service.getHealth(), 'Health fetched');
  }

  @Get('errors')
  @ApiOperation({ summary: 'Error rate and top failing endpoints' })
  @ApiQuery({ name: 'period', required: false, enum: ['24h', '7d'] })
  async getErrors(@Query('period') period?: string) {
    return new ResponseItem(await this.service.getErrors(period), 'Errors fetched');
  }

  @Get('performance')
  @ApiOperation({ summary: 'API latency trends' })
  @ApiQuery({ name: 'period', required: false, enum: ['24h', '7d'] })
  async getPerformance(@Query('period') period?: string) {
    return new ResponseItem(await this.service.getPerformance(period), 'Performance fetched');
  }
}
