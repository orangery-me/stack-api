import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { CanvasService } from './canvas.service';
import { CanvasDto } from './dto/canvas.dto';
import { CreateCanvasDto } from './dto/create-canvas.dto';

@ApiTags('workspace-canvases')
@Controller('/workspaces/:workspaceId/canvases')
export class WorkspaceCanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @UseGuards(JwtAccessTokenGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tạo canvas mới trong workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiBody({ type: CreateCanvasDto })
  @ApiResponse({
    status: 201,
    description: 'Canvas created successfully',
    type: CanvasDto,
  })
  async createCanvasForWorkspace(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateCanvasDto
  ): Promise<ResponseItem<CanvasDto>> {
    const result = await this.canvasService.createCanvasForWorkspace(workspaceId, request.user.userId, dto);
    return new ResponseItem<CanvasDto>(result, 'Canvas created successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('my')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Danh sách canvas do tôi sở hữu trong workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 200,
    description: 'My canvases fetched successfully',
    type: [CanvasDto],
  })
  async getMyCanvases(@Req() request, @Param('workspaceId') workspaceId: string): Promise<ResponseItem<CanvasDto[]>> {
    const result = await this.canvasService.getMyCanvases(workspaceId, request.user.userId);
    return new ResponseItem<CanvasDto[]>(result, 'My canvases fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('recent')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Danh sách canvas gần đây tôi đã mở trong workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 200,
    description: 'Recent canvases fetched successfully',
    type: [CanvasDto],
  })
  async getRecentCanvases(
    @Req() request,
    @Param('workspaceId') workspaceId: string
  ): Promise<ResponseItem<CanvasDto[]>> {
    const result = await this.canvasService.getRecentCanvases(workspaceId, request.user.userId);
    return new ResponseItem<CanvasDto[]>(result, 'Recent canvases fetched successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('shared-with-me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Danh sách canvas được share cho tôi trong workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 200,
    description: 'Shared-with-me canvases fetched successfully',
    type: [CanvasDto],
  })
  async getSharedWithMeCanvases(
    @Req() request,
    @Param('workspaceId') workspaceId: string
  ): Promise<ResponseItem<CanvasDto[]>> {
    const result = await this.canvasService.getSharedWithMeCanvases(workspaceId, request.user.userId);
    return new ResponseItem<CanvasDto[]>(result, 'Shared-with-me canvases fetched successfully');
  }
}
