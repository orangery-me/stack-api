import { Controller, Get, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAccessTokenGuard } from '../../auth/guards/jwt-access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@Constant/enums';
import { AdminWorkspaceTasksService } from './admin-workspace-tasks.service';

@ApiTags('admin / workspace-tasks')
@Controller('admin/workspaces/:workspaceId/tasks')
@UseGuards(JwtAccessTokenGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN, UserRoleEnum.USER, UserRoleEnum.MODERATOR)
@ApiBearerAuth('JWT-auth')
export class AdminWorkspaceTasksController {
  constructor(private readonly service: AdminWorkspaceTasksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all tasks in a workspace (admin/owner view)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['todo', 'in_progress', 'done'] })
  @ApiQuery({ name: 'priority', required: false, enum: ['low', 'medium', 'high', 'urgent'] })
  @ApiQuery({ name: 'assigneeId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by task title' })
  async getWorkspaceTasks(
    @Param('workspaceId') workspaceId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('take', new DefaultValuePipe(1000), ParseIntPipe) take: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('search') search?: string
  ) {
    return this.service.getWorkspaceTasks(workspaceId, {
      page,
      take,
      status,
      priority,
      assigneeId,
      search,
    });
  }
}
