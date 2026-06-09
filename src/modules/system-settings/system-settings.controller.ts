import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@Constant/enums';
import { SystemSettingsService } from './system-settings.service';
import { SystemSetting } from './entities/system-setting.entity';
import { UpdateSettingsDto } from './dto/update-setting.dto';

@ApiTags('admin / system-settings')
@Controller('admin/settings')
@UseGuards(JwtAccessTokenGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class SystemSettingsController {
  constructor(private readonly settingsService: SystemSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system settings' })
  async getAll(): Promise<ResponseItem<SystemSetting>> {
    const data = await this.settingsService.findAll();
    return new ResponseItem(data, 'Settings fetched successfully');
  }

  @Patch()
  @ApiOperation({ summary: 'Update system settings' })
  async update(@Body() dto: UpdateSettingsDto): Promise<ResponseItem<SystemSetting>> {
    const data = await this.settingsService.update(dto);
    return new ResponseItem(data, 'Settings updated successfully');
  }
}
