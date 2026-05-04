import { ApiProperty } from '@nestjs/swagger';

export class TaskAssigneeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceMemberId: string;

  @ApiProperty({ required: false })
  userId?: string;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty({ required: false })
  avatar?: string | null;

  @ApiProperty()
  assignedAt: Date;
}

export class TaskDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  channelId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false })
  description?: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  priority: string;

  @ApiProperty({ required: false })
  dueDate?: Date | null;

  @ApiProperty({ required: false })
  createdById?: string;

  @ApiProperty({ required: false })
  creatorName?: string;

  @ApiProperty({ required: false })
  creatorEmail?: string;

  @ApiProperty({ type: [TaskAssigneeDto], required: false })
  assignees?: TaskAssigneeDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
