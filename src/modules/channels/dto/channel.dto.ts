import { ApiProperty } from '@nestjs/swagger';
import { ChannelType } from './create-channel.dto';

export class ChannelDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty({ enum: ChannelType })
  type: ChannelType;

  @ApiProperty({ required: false })
  name?: string | null;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false, type: 'object' })
  metadata?: Record<string, any>;

  @ApiProperty({ required: false, type: 'object' })
  settings?: Record<string, any>;

  @ApiProperty({ required: false })
  isDefault?: boolean;
}
