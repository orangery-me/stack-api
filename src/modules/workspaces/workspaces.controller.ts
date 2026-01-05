import { ResponseItem } from '@app/common/dtos';
import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Tạo workspace mới' })
  @ApiBody({ type: CreateWorkspaceDto })
  @ApiResponse({
    status: 201,
    description: 'Tạo workspace thành công',
    type: WorkspaceDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async createWorkspace(@Req() request, @Body() createDto: CreateWorkspaceDto): Promise<ResponseItem<WorkspaceDto>> {
    return this.workspacesService.createWorkspace(request.user.userId, createDto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post(':id/invite')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Gửi lời mời thành viên vào workspace' })
  @ApiParam({ name: 'id', description: 'ID của workspace' })
  @ApiBody({ type: InviteMemberDto })
  @ApiResponse({
    status: 200,
    description: 'Gửi lời mời thành công',
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc không có quyền' })
  @ApiResponse({ status: 404, description: 'Workspace hoặc user không tồn tại' })
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
  @ApiOperation({ summary: 'Chấp nhận lời mời tham gia workspace' })
  @ApiBody({ type: AcceptInviteDto })
  @ApiResponse({
    status: 200,
    description: 'Chấp nhận lời mời thành công',
  })
  @ApiResponse({ status: 400, description: 'Token không hợp lệ hoặc đã hết hạn' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 404, description: 'Token không tồn tại' })
  async acceptInvite(
    @Req() request,
    @Body() acceptDto: AcceptInviteDto
  ): Promise<ResponseItem<{ message: string; workspaceId: string }>> {
    return this.workspacesService.acceptInvite(acceptDto.token, request.user.userId);
  }

  @Get('invite/accept')
  @ApiOperation({ summary: 'Chấp nhận lời mời tham gia workspace qua URL (GET)' })
  @ApiResponse({
    status: 400,
    description: 'Vui lòng đăng nhập và sử dụng POST endpoint',
  })
  async acceptInviteByUrl(@Query('token') token: string): Promise<void> {
    // This endpoint requires authentication
    // Frontend should handle login and then call POST /workspaces/invite/accept
    throw new BadRequestException('Vui lòng đăng nhập và sử dụng POST /workspaces/invite/accept với token trong body');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy danh sách workspaces của user hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách workspaces thành công',
    type: [WorkspaceDto],
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async getUserWorkspaces(@Req() request): Promise<ResponseItem<WorkspaceDto[]>> {
    return this.workspacesService.getUserWorkspaces(request.user.userId);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get(':id/members')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy danh sách members trong workspace' })
  @ApiParam({ name: 'id', description: 'ID của workspace' })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách members thành công',
    type: [WorkspaceMemberDto],
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  @ApiResponse({ status: 404, description: 'Workspace không tồn tại' })
  async getWorkspaceMembers(@Param('id') workspaceId: string): Promise<ResponseItem<WorkspaceMemberDto[]>> {
    return this.workspacesService.getWorkspaceMembers(workspaceId);
  }
}
