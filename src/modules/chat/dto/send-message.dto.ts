import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Message content',
    example: 'Hello, world!',
  })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Message type',
    example: 'text',
    required: false,
    default: 'text',
  })
  @IsOptional()
  @IsString()
  messageType?: string;

  @ApiProperty({
    description: 'Structured metadata for system messages',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
