import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../../auth/guards/jwt-access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@Constant/enums';
import { AdminContentService } from './admin-content.service';

@ApiTags('admin / content')
@Controller('admin')
@UseGuards(JwtAccessTokenGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminContentController {
  constructor(private readonly service: AdminContentService) {}

  @Get('canvases')
  @ApiOperation({ summary: 'List canvases cross-workspace' })
  async getCanvases(@Query('page') page?: number, @Query('size') size?: number) {
    const result = await this.service.getCanvases(page, size);
    return { data: result.data, meta: result.meta, message: 'Canvases fetched' };
  }

  @Get('canvases/stats')
  @ApiOperation({ summary: 'Canvas stats' })
  async getCanvasStats() {
    return new ResponseItem(await this.service.getCanvasStats(), 'Canvas stats fetched');
  }

  @Get('channels')
  @ApiOperation({ summary: 'List channels cross-workspace' })
  async getChannels(@Query('page') page?: number, @Query('size') size?: number) {
    const result = await this.service.getChannels(page, size);
    return { data: result.data, meta: result.meta, message: 'Channels fetched' };
  }
}
