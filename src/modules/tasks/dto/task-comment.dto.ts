import { ApiProperty } from '@nestjs/swagger';

export class TaskCommentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  taskId: string;

  @ApiProperty()
  workspaceMemberId: string;

  @ApiProperty({ required: false })
  userId?: string;

  @ApiProperty({ required: false })
  authorName?: string;

  @ApiProperty({ required: false })
  authorEmail?: string;

  @ApiProperty({ required: false })
  authorAvatar?: string | null;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [String] })
  mentions: string[];

  @ApiProperty({ required: false })
  parentCommentId?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  editedAt?: Date | null;

  @ApiProperty({ required: false })
  deletedAt?: Date | null;
}
