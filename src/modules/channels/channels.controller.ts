import { Body, Controller, Delete, Get, Patch, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { CreateDirectMessageDto } from './dto/create-direct-message.dto';
import { ChannelDto } from './dto/channel.dto';
import { AddChannelMemberDto } from './dto/add-channel-member.dto';
import { ChannelMemberDto } from './dto/channel-member.dto';
import { UpdateChannelPermissionsDto } from './dto/update-channel-permissions.dto';

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
  @Post('direct-messages')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Find or create a direct-message channel with a workspace member' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiBody({ type: CreateDirectMessageDto })
  @ApiResponse({
    status: 201,
    description: 'Direct message channel fetched or created successfully',
    type: ChannelDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not a workspace member' })
  @ApiResponse({ status: 404, description: 'Target user not found in workspace' })
  async findOrCreateDirectMessage(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDirectMessageDto
  ): Promise<ResponseItem<ChannelDto>> {
    return this.channelsService.findOrCreateDirectMessage(workspaceId, request.user.userId, dto);
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

  @UseGuards(JwtAccessTokenGuard)
  @Post(':channelId/members')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add a member to channel' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  async addMember(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Body() dto: AddChannelMemberDto
  ): Promise<ResponseItem<{ message: string }>> {
    return this.channelsService.addMember(workspaceId, channelId, request.user.userId, dto);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get(':channelId/members')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get members of a channel' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiResponse({
    status: 200,
    description: 'Channel members fetched successfully',
    type: [ChannelMemberDto],
  })
  async getChannelMembers(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string
  ): Promise<ResponseItem<ChannelMemberDto[]>> {
    return this.channelsService.getChannelMembers(workspaceId, channelId, request.user.userId);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Delete(':channelId/members/:userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove a member from channel' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'userId', description: 'User ID to remove from the channel' })
  async kickMember(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('userId') userId: string
  ): Promise<ResponseItem<{ message: string }>> {
    return this.channelsService.kickMember(workspaceId, channelId, request.user.userId, userId);
  }

  @UseGuards(JwtAccessTokenGuard)
  @Patch(':channelId/settings/permissions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update channel dynamic permissions (manager only)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiBody({ type: UpdateChannelPermissionsDto })
  @ApiResponse({
    status: 200,
    description: 'Channel updated successfully',
    type: ChannelDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - not a channel manager' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async updateChannelPermissions(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateChannelPermissionsDto
  ): Promise<ResponseItem<ChannelDto>> {
    return this.channelsService.updateChannelPermissions(workspaceId, channelId, request.user.userId, dto);
  }
}
