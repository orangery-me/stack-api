import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResponseItem } from '@app/common/dtos';
import { JwtAccessTokenGuard } from '../auth/guards/jwt-access-token.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages.dto';
import { MessageDto, MessagesResponseDto } from './dto/message.dto';
import { memoryFileUploadOptions, resolveMaxUploadMb } from '../storage/file-upload.options';

const CHAT_ATTACHMENT_MAX_MB = resolveMaxUploadMb(process.env.CHAT_ATTACHMENT_MAX_MB);

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

  @UseGuards(JwtAccessTokenGuard)
  @Post('attachments/upload')
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a chat message attachment' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', memoryFileUploadOptions(CHAT_ATTACHMENT_MAX_MB)))
  async uploadAttachment(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('kind') kind?: 'file' | 'image' | 'video' | 'audio'
  ): Promise<ResponseItem<Record<string, unknown>>> {
    const result = await this.chatService.uploadAttachment(workspaceId, channelId, request.user.userId, file, kind);
    return new ResponseItem<Record<string, unknown>>(result, 'Attachment uploaded successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Post(':messageId/pin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Pin a channel message' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  async pinMessage(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string
  ): Promise<ResponseItem<MessageDto>> {
    const result = await this.chatService.pinMessage(workspaceId, channelId, request.user.userId, messageId);
    return new ResponseItem(result as MessageDto, 'Message pinned successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Delete(':messageId/pin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unpin a channel message' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  async unpinMessage(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string
  ): Promise<ResponseItem<MessageDto>> {
    const result = await this.chatService.unpinMessage(workspaceId, channelId, request.user.userId, messageId);
    return new ResponseItem(result as MessageDto, 'Message unpinned successfully');
  }

  @UseGuards(JwtAccessTokenGuard)
  @Delete(':messageId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a channel message' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiParam({ name: 'channelId', description: 'Channel ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  async deleteMessage(
    @Req() request,
    @Param('workspaceId') workspaceId: string,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string
  ): Promise<ResponseItem<{ id: string; channelId: string }>> {
    const result = await this.chatService.deleteMessage(workspaceId, channelId, request.user.userId, messageId);
    return new ResponseItem(result, 'Message deleted successfully');
  }
}
