import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { ChannelDto } from './dto/channel.dto';

@ApiTags('channels')
@Controller('workspaces/:workspaceId/channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @UseGuards(JwtAccessTokenGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new channel in a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiBody({ type: CreateChannelDto })
  @ApiResponse({
    status: 201,
    description: 'Channel created successfully',
    type: ChannelDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async createChannel(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Body() createDto: CreateChannelDto
  ): Promise<ResponseItem<ChannelDto>> {
    return this.channelsService.createChannel(workspaceId, request.user.userId, createDto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all channels in a workspace (admin only)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 200,
    description: 'Channels fetched successfully',
    type: [ChannelDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not admin or owner' })
  async getAllChannels(@Req() request, @Param('workspaceId') workspaceId: string): Promise<ResponseItem<ChannelDto[]>> {
    return this.channelsService.getAllChannels(workspaceId, request.user.userId);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get('my')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get channels where user is a member' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 200,
    description: 'User channels fetched successfully',
    type: [ChannelDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not a workspace member' })
  async getUserChannels(
    @Req() request,
    @Param('workspaceId') workspaceId: string
  ): Promise<ResponseItem<ChannelDto[]>> {
    return this.channelsService.getUserChannels(workspaceId, request.user.userId);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get(':channelId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get channel details by ID' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 200,
    description: 'Channel fetched successfully',
    type: ChannelDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not a channel member' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async getChannelById(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string
  ): Promise<ResponseItem<ChannelDto>> {
    return this.channelsService.getChannelById(workspaceId, channelId, request.user.userId);
  }
}
