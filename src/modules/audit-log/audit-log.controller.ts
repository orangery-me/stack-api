import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@Constant/enums';
import { AuditLogService } from './audit-log.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@ApiTags('admin / audit-logs')
@Controller('admin/audit-logs')
@UseGuards(JwtAccessTokenGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs with pagination and filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'size', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  async findAll(@Query() query: ListAuditLogsDto) {
    const result = await this.auditLogService.findAll(query);
    return new ResponseItem(result.data, 'Audit logs fetched successfully');
  }
}
