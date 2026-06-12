import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ShareCanvasWithChannelDto {
  @ApiProperty({
    description: 'ID của channel trong cùng workspace',
  })
  @IsUUID('4', { message: 'channelId không hợp lệ' })
  channelId: string;

  @ApiProperty({
    description: 'Quyền share cho channel',
    enum: ['viewer', 'editor'],
  })
  @IsIn(['viewer', 'editor'])
  role: 'viewer' | 'editor';

  @ApiProperty({
    description: 'Skip posting the canvas share system message',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  suppressSystemMessage?: boolean;
}
