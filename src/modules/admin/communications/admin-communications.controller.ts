import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../../auth/guards/jwt-access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@Constant/enums';
import { AdminCommunicationsService } from './admin-communications.service';

@ApiTags('admin / communications')
@Controller('admin/communications')
@UseGuards(JwtAccessTokenGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminCommunicationsController {
  constructor(private readonly service: AdminCommunicationsService) {}

  @Get('huddles')
  @ApiOperation({ summary: 'Call history' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getHuddles(@Query('from') from?: string, @Query('to') to?: string) {
    return new ResponseItem(await this.service.getHuddles(from, to), 'Huddles fetched');
  }

  @Get('huddles/stats')
  @ApiOperation({ summary: 'Call stats' })
  async getHuddleStats() {
    return new ResponseItem(await this.service.getHuddleStats(), 'Huddle stats fetched');
  }
}
