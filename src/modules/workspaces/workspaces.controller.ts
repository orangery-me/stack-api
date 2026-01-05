import { ResponseItem } from '@app/common/dtos';
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { WorkspaceDto } from './dto/workspace.dto';
import { WorkspaceMemberDto } from './dto/workspace-member.dto';

@ApiTags('workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @UseGuards(JwtAccessTokenGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiBody({ type: CreateWorkspaceDto })
  @ApiResponse({
    status: 201,
    description: 'Workspace created successfully',
    type: WorkspaceDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async createWorkspace(@Req() request, @Body() createDto: CreateWorkspaceDto): Promise<ResponseItem<WorkspaceDto>> {
    return this.workspacesService.createWorkspace(request.user.userId, createDto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post(':id/invite')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Send an invitation to a workspace member' })
  @ApiParam({ name: 'id', description: 'Workspace ID' })
  @ApiBody({ type: InviteMemberDto })
  @ApiResponse({
    status: 200,
    description: 'Invitation sent successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Not authenticated or not authorized' })
  @ApiResponse({ status: 404, description: 'Workspace or user not found' })
  async inviteMember(
    @Req() request,
    @Param('id') workspaceId: string,
    @Body() inviteDto: InviteMemberDto
  ): Promise<ResponseItem<{ message: string }>> {
    return this.workspacesService.inviteMember(workspaceId, request.user.userId, inviteDto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post('invite/accept')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Accept workspace invitation' })
  @ApiBody({ type: AcceptInviteDto })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
  })
  @ApiResponse({ status: 400, description: 'Token is invalid or has expired' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Token not found' })
  async acceptInvite(
    @Req() request,
    @Body() acceptDto: AcceptInviteDto
  ): Promise<ResponseItem<{ message: string; workspaceId: string }>> {
    return this.workspacesService.acceptInvite(acceptDto.token, request.user.userId);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post('invite/accept')
  @ApiOperation({ summary: 'Accept workspace invitation' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 400,
    description: 'Please log in and use the POST endpoint',
  })
  async acceptInviteByUrl(
    @Req() request,
    @Body('token') token: string
  ): Promise<ResponseItem<{ message: string; workspaceId: string }>> {
    return this.workspacesService.acceptInvite(token, request.user.userId);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get list of workspaces of the current user' })
  @ApiResponse({
    status: 200,
    description: 'Workspaces fetched successfully',
    type: [WorkspaceDto],
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getUserWorkspaces(@Req() request): Promise<ResponseItem<WorkspaceDto[]>> {
    return this.workspacesService.getUserWorkspaces(request.user.userId);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get(':id/members')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get members of a workspace' })
  @ApiParam({ name: 'id', description: 'Workspace ID' })
  @ApiResponse({
    status: 200,
    description: 'Workspace members fetched successfully',
    type: [WorkspaceMemberDto],
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getWorkspaceMembers(@Param('id') workspaceId: string): Promise<ResponseItem<WorkspaceMemberDto[]>> {
    return this.workspacesService.getWorkspaceMembers(workspaceId);
  }
}
