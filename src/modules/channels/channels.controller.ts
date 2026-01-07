import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
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
}
