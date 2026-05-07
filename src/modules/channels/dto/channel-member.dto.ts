import { ApiProperty } from '@nestjs/swagger';

export class ChannelMemberDto {
  @ApiProperty()
  channelId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  workspaceMemberId: string;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ required: false })
  avatar?: string;

  @ApiProperty({ enum: ['manager', 'member'] })
  memberRole: 'manager' | 'member';

  @ApiProperty()
  joinedAt: Date;
}
