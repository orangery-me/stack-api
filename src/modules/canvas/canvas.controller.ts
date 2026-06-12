import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { CanvasService } from './canvas.service';
import { CreateCanvasDto } from './dto/create-canvas.dto';
import { UpdateCanvasDto } from './dto/update-canvas.dto';
import { CanvasDto } from './dto/canvas.dto';
import { CanvasPermissionListDto } from './dto/canvas-permission.dto';
import { ShareCanvasWithUserDto } from './dto/share-canvas-user.dto';
import { ShareCanvasWithChannelDto } from './dto/share-canvas-channel.dto';
import { UpdateCanvasVisibilityDto } from './dto/update-canvas-visibility.dto';
import { CanvasAccessDto } from './dto/canvas-access.dto';
import { CanvasCollabTokenDto } from './dto/canvas-collab-token.dto';

@ApiTags('canvas')
@Controller('/canvases')
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @UseGuards(JwtAccessTokenGuard)
  @Get(':canvasId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy chi tiết 1 canvas (kèm nội dung hiện tại)' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiResponse({
    status: 200,
    description: 'Canvas fetched successfully',
    type: CanvasDto,
  })
  async getCanvas(@Req() request, @Param('canvasId') canvasId: string): Promise<ResponseItem<CanvasDto>> {
    const result = await this.canvasService.getCanvas(canvasId, request.user.userId);
    return new ResponseItem<CanvasDto>(result, 'Canvas fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get(':canvasId/access')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Kiểm tra quyền truy cập canvas cho collab server' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiResponse({
    status: 200,
    description: 'Canvas access fetched successfully',
    type: CanvasAccessDto,
  })
  async getCanvasAccess(
    @Req() request,
    @Param('canvasId') canvasId: string
  ): Promise<ResponseItem<CanvasAccessDto>> {
    const result = await this.canvasService.getCanvasAccess(canvasId, request.user.userId);
    return new ResponseItem<CanvasAccessDto>(result, 'Canvas access fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post(':canvasId/collab-token')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cấp token ngắn hạn để kết nối canvas collab server' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiResponse({
    status: 200,
    description: 'Canvas collab token issued successfully',
    type: CanvasCollabTokenDto,
  })
  async createCanvasCollabToken(
    @Req() request,
    @Param('canvasId') canvasId: string
  ): Promise<ResponseItem<CanvasCollabTokenDto>> {
    const result = await this.canvasService.createCanvasCollabToken(canvasId, request.user.userId);
    return new ResponseItem<CanvasCollabTokenDto>(result, 'Canvas collab token issued successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post(':canvasId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cập nhật canvas (title riêng, không gắn với content)' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiBody({ type: UpdateCanvasDto })
  @ApiResponse({
    status: 200,
    description: 'Canvas updated successfully',
    type: CanvasDto,
  })
  async updateCanvas(
    @Req() request,
    @Param('canvasId') canvasId: string,
    @Body() dto: UpdateCanvasDto
  ): Promise<ResponseItem<CanvasDto>> {
    const result = await this.canvasService.updateCanvas(canvasId, request.user.userId, dto);
    return new ResponseItem<CanvasDto>(result, 'Canvas updated successfully');
  }

  // --- Permissions & visibility ---

  @UseGuards(JwtAccessTokenGuard)
  @Get(':canvasId/permissions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy danh sách share + visibility của canvas' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiResponse({
    status: 200,
    description: 'Canvas permissions fetched successfully',
    type: CanvasPermissionListDto,
  })
  async getCanvasPermissions(
    @Req() request,
    @Param('canvasId') canvasId: string
  ): Promise<ResponseItem<CanvasPermissionListDto>> {
    const result = await this.canvasService.getCanvasPermissions(canvasId, request.user.userId);
    return new ResponseItem<CanvasPermissionListDto>(result, 'Canvas permissions fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post(':canvasId/permissions/users')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Share canvas cho 1 user trong workspace' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiBody({ type: ShareCanvasWithUserDto })
  @ApiResponse({
    status: 200,
    description: 'Canvas shared with user successfully',
    type: CanvasPermissionListDto,
  })
  async shareCanvasWithUser(
    @Req() request,
    @Param('canvasId') canvasId: string,
    @Body() dto: ShareCanvasWithUserDto
  ): Promise<ResponseItem<CanvasPermissionListDto>> {
    const result = await this.canvasService.shareCanvasWithUser(canvasId, request.user.userId, dto);
    return new ResponseItem<CanvasPermissionListDto>(result, 'Canvas shared with user successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post(':canvasId/permissions/channels')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Share canvas cho 1 channel trong workspace' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiBody({ type: ShareCanvasWithChannelDto })
  @ApiResponse({
    status: 200,
    description: 'Canvas shared with channel successfully',
    type: CanvasPermissionListDto,
  })
  async shareCanvasWithChannel(
    @Req() request,
    @Param('canvasId') canvasId: string,
    @Body() dto: ShareCanvasWithChannelDto
  ): Promise<ResponseItem<CanvasPermissionListDto>> {
    const result = await this.canvasService.shareCanvasWithChannel(canvasId, request.user.userId, dto);
    return new ResponseItem<CanvasPermissionListDto>(result, 'Canvas shared with channel successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Patch(':canvasId/visibility')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cập nhật visibility cho canvas' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiBody({ type: UpdateCanvasVisibilityDto })
  @ApiResponse({
    status: 200,
    description: 'Canvas visibility updated successfully',
    type: CanvasPermissionListDto,
  })
  async updateCanvasVisibility(
    @Req() request,
    @Param('canvasId') canvasId: string,
    @Body() dto: UpdateCanvasVisibilityDto
  ): Promise<ResponseItem<CanvasPermissionListDto>> {
    const result = await this.canvasService.updateCanvasVisibility(canvasId, request.user.userId, dto);
    return new ResponseItem<CanvasPermissionListDto>(result, 'Canvas visibility updated successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Delete(':canvasId/permissions/:permissionId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Xoá 1 permission share cụ thể' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  @ApiResponse({
    status: 200,
    description: 'Canvas permission removed successfully',
    type: CanvasPermissionListDto,
  })
  async removeCanvasPermission(
    @Req() request,
    @Param('canvasId') canvasId: string,
    @Param('permissionId') permissionId: string
  ): Promise<ResponseItem<CanvasPermissionListDto>> {
    const result = await this.canvasService.removeCanvasPermission(canvasId, request.user.userId, permissionId);
    return new ResponseItem<CanvasPermissionListDto>(result, 'Canvas permission removed successfully');
  }
}
