import { Body, Controller, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { CanvasService } from './canvas.service';
import { CreateCanvasDto } from './dto/create-canvas.dto';
import { SaveCanvasContentDto } from './dto/save-canvas-content.dto';
import { UpdateCanvasDto } from './dto/update-canvas.dto';
import { CanvasDto } from './dto/canvas.dto';
import { CanvasVersionDto } from './dto/canvas-version.dto';

@ApiTags('canvas')
@Controller('workspaces/:workspaceId/channels/:channelId/canvases')
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @UseGuards(JwtAccessTokenGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tạo canvas mới trong channel' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiBody({ type: CreateCanvasDto })
  @ApiResponse({
    status: 201,
    description: 'Canvas created successfully',
    type: CanvasDto,
  })
  async createCanvas(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Body() dto: CreateCanvasDto
  ): Promise<ResponseItem<CanvasDto>> {
    const result = await this.canvasService.createCanvas(workspaceId, channelId, request.user.userId, dto);
    return new ResponseItem<CanvasDto>(result, 'Canvas created successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy danh sách canvas trong channel' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 200,
    description: 'Canvases fetched successfully',
    type: [CanvasDto],
  })
  async getCanvases(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string
  ): Promise<ResponseItem<CanvasDto[]>> {
    const result = await this.canvasService.getCanvasesForChannel(workspaceId, channelId, request.user.userId);
    return new ResponseItem<CanvasDto[]>(result, 'Canvases fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get(':canvasId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy chi tiết 1 canvas (kèm nội dung hiện tại)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiResponse({
    status: 200,
    description: 'Canvas fetched successfully',
    type: CanvasDto,
  })
  async getCanvas(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('canvasId') canvasId: string
  ): Promise<ResponseItem<CanvasDto>> {
    const result = await this.canvasService.getCanvas(workspaceId, channelId, canvasId, request.user.userId);
    return new ResponseItem<CanvasDto>(result, 'Canvas fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Patch(':canvasId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cập nhật canvas (title riêng, không gắn với content)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiBody({ type: UpdateCanvasDto })
  @ApiResponse({
    status: 200,
    description: 'Canvas updated successfully',
    type: CanvasDto,
  })
  async updateCanvas(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('canvasId') canvasId: string,
    @Body() dto: UpdateCanvasDto
  ): Promise<ResponseItem<CanvasDto>> {
    const result = await this.canvasService.updateCanvas(workspaceId, channelId, canvasId, request.user.userId, dto);
    return new ResponseItem<CanvasDto>(result, 'Canvas updated successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Put(':canvasId/content')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Auto-save nội dung canvas hiện tại' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiBody({ type: SaveCanvasContentDto })
  @ApiResponse({
    status: 200,
    description: 'Canvas content saved successfully',
    type: CanvasDto,
  })
  async saveCanvasContent(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('canvasId') canvasId: string,
    @Body() dto: SaveCanvasContentDto
  ): Promise<ResponseItem<CanvasDto>> {
    const result = await this.canvasService.saveCanvasContent(
      workspaceId,
      channelId,
      canvasId,
      request.user.userId,
      dto
    );
    return new ResponseItem<CanvasDto>(result, 'Canvas content saved successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post(':canvasId/versions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lưu version cho canvas từ nội dung hiện tại' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiResponse({
    status: 201,
    description: 'Canvas version created successfully',
    type: CanvasVersionDto,
  })
  async createCanvasVersion(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('canvasId') canvasId: string
  ): Promise<ResponseItem<CanvasVersionDto>> {
    const result = await this.canvasService.createCanvasVersion(workspaceId, channelId, canvasId, request.user.userId);
    return new ResponseItem<CanvasVersionDto>(result, 'Canvas version created successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get(':canvasId/versions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy danh sách version của canvas' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiResponse({
    status: 200,
    description: 'Canvas versions fetched successfully',
    type: [CanvasVersionDto],
  })
  async getCanvasVersions(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('canvasId') canvasId: string
  ): Promise<ResponseItem<CanvasVersionDto[]>> {
    const result = await this.canvasService.getCanvasVersions(workspaceId, channelId, canvasId, request.user.userId);
    return new ResponseItem<CanvasVersionDto[]>(result, 'Canvas versions fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get(':canvasId/versions/:version')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy chi tiết 1 version của canvas' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiParam({ name: 'version', description: 'Version number' })
  @ApiResponse({
    status: 200,
    description: 'Canvas version fetched successfully',
    type: CanvasVersionDto,
  })
  async getCanvasVersion(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('canvasId') canvasId: string,
    @Param('version') version: string
  ): Promise<ResponseItem<CanvasVersionDto>> {
    const versionNumber = parseInt(version, 10);
    const result = await this.canvasService.getCanvasVersion(
      workspaceId,
      channelId,
      canvasId,
      versionNumber,
      request.user.userId
    );
    return new ResponseItem<CanvasVersionDto>(result, 'Canvas version fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post(':canvasId/versions/:version/revert')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Revert canvas về 1 version cũ' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'canvasId', description: 'Canvas ID' })
  @ApiParam({ name: 'version', description: 'Version number' })
  @ApiResponse({
    status: 200,
    description: 'Canvas reverted successfully',
    type: CanvasDto,
  })
  async revertCanvasVersion(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('canvasId') canvasId: string,
    @Param('version') version: string
  ): Promise<ResponseItem<CanvasDto>> {
    const versionNumber = parseInt(version, 10);
    const result = await this.canvasService.revertCanvasToVersion(
      workspaceId,
      channelId,
      canvasId,
      versionNumber,
      request.user.userId
    );
    return new ResponseItem<CanvasDto>(result, 'Canvas reverted successfully');
  }
}
