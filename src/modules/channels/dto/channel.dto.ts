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
}
