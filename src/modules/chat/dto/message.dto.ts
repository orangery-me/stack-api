import { ApiProperty } from '@nestjs/swagger';

export class MessageDto {
  @ApiProperty({ description: 'Message ID' })
  id: string;

  @ApiProperty({ description: 'Sender user ID' })
  senderId: string;

  @ApiProperty({ description: 'Sender name' })
  senderName: string;

  @ApiProperty({ description: 'Sender email' })
  senderEmail: string;

  @ApiProperty({ description: 'Sender avatar URL', nullable: true })
  senderAvatar: string | null;

  @ApiProperty({ description: 'Message content' })
  content: string;

  @ApiProperty({ description: 'Message type', example: 'text' })
  messageType: string;

  @ApiProperty({ description: 'Message creation timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Channel ID' })
  channelId: string;
}

export class MessagesResponseDto {
  @ApiProperty({ type: [MessageDto], description: 'List of messages' })
  messages: MessageDto[];

  @ApiProperty({ description: 'Whether there are more messages to load' })
  hasMore: boolean;

  @ApiProperty({ description: 'Current page number' })
  page: number;
}
