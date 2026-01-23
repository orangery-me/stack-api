import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages.dto';
import { MessageDto, MessagesResponseDto } from './dto/message.dto';

@ApiTags('chat')
@Controller('workspaces/:workspaceId/channels/:channelId/messages')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(JwtAccessTokenGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Send a message to a channel' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully',
    type: MessageDto,
  })
  @ApiResponse({ status: 403, description: 'Not a channel member' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async sendMessage(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Body() dto: SendMessageDto
  ): Promise<ResponseItem<MessageDto>> {
    const result = await this.chatService.sendMessage(workspaceId, channelId, request.user.userId, dto);
    return new ResponseItem(result as MessageDto, 'Message sent successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get messages from a channel' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'size', required: false, description: 'Page size (default: 20)' })
  @ApiResponse({
    status: 200,
    description: 'Messages fetched successfully',
    type: MessagesResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Not a channel member' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async getMessages(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Query() query: GetMessagesQueryDto
  ): Promise<ResponseItem<MessagesResponseDto>> {
    const result = await this.chatService.getMessages(
      workspaceId,
      channelId,
      request.user.userId,
      query.page,
      query.size
    );
    return new ResponseItem(result as MessagesResponseDto, 'Messages fetched successfully');
  }
}
