import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../../auth/guards/jwt-access-token.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRoleEnum } from '@Constant/enums';
import { AdminWorkspaceRolesService } from './admin-workspace-roles.service';
import { CreateWorkspaceRoleDto } from '../dto/create-workspace-role.dto';
import { UpdateWorkspaceRoleDto } from '../dto/update-workspace-role.dto';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto';

@ApiTags('admin / workspace-roles')
@Controller('admin')
@UseGuards(JwtAccessTokenGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN, UserRoleEnum.USER, UserRoleEnum.MODERATOR)
@ApiBearerAuth('JWT-auth')
export class AdminWorkspaceRolesController {
  constructor(private readonly service: AdminWorkspaceRolesService) {}

  @Get('workspaces/:workspaceId/roles')
  @ApiOperation({ summary: 'Get all roles of a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  async getWorkspaceRoles(@Req() req, @Param('workspaceId') workspaceId: string) {
    const data = await this.service.getWorkspaceRoles(workspaceId, req.user.userId, req.user.role);
    return new ResponseItem(data, 'Workspace roles fetched successfully');
  }

  @Post('workspaces/:workspaceId/roles')
  @ApiOperation({ summary: 'Create a new role for a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiBody({ type: CreateWorkspaceRoleDto })
  async createWorkspaceRole(
    @Req() req,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateWorkspaceRoleDto,
  ) {
    const data = await this.service.createWorkspaceRole(workspaceId, dto, req.user.userId, req.user.role);
    return new ResponseItem(data, 'Workspace role created successfully');
  }

  @Put('workspace-roles/:id')
  @ApiOperation({ summary: 'Update a workspace role' })
  @ApiParam({ name: 'id', description: 'Workspace Role ID' })
  @ApiBody({ type: UpdateWorkspaceRoleDto })
  async updateWorkspaceRole(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceRoleDto,
  ) {
    const data = await this.service.updateWorkspaceRole(id, dto, req.user.userId, req.user.role);
    return new ResponseItem(data, 'Workspace role updated successfully');
  }

  @Delete('workspace-roles/:id')
  @ApiOperation({ summary: 'Delete a workspace role' })
  @ApiParam({ name: 'id', description: 'Workspace Role ID' })
  async deleteWorkspaceRole(@Req() req, @Param('id') id: string) {
    await this.service.deleteWorkspaceRole(id, req.user.userId, req.user.role);
    return new ResponseItem(null, 'Workspace role deleted successfully');
  }

  @Put('workspace-members/:memberId/role')
  @ApiOperation({ summary: 'Update workspace member role' })
  @ApiParam({ name: 'memberId', description: 'Workspace Member ID' })
  @ApiBody({ type: UpdateMemberRoleDto })
  async updateMemberRole(
    @Req() req,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const data = await this.service.updateMemberRole(memberId, dto.roleId, req.user.userId, req.user.role);
    return new ResponseItem(data, 'Workspace member role updated successfully');
  }

  @Delete('workspace-members/:memberId')
  @ApiOperation({ summary: 'Remove workspace member' })
  @ApiParam({ name: 'memberId', description: 'Workspace Member ID' })
  async removeWorkspaceMember(@Req() req, @Param('memberId') memberId: string) {
    await this.service.removeWorkspaceMember(memberId, req.user.userId, req.user.role);
    return new ResponseItem(null, 'Workspace member removed successfully');
  }
}
