import { ApiProperty } from '@nestjs/swagger';
import { TaskAttachmentDto } from './task-attachment.dto';

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

  @ApiProperty({ required: false })
  taskListId?: string | null;

  @ApiProperty({ required: false })
  parentTaskId?: string | null;

  @ApiProperty({ type: [TaskAttachmentDto], required: false })
  attachments?: TaskAttachmentDto[];

  @ApiProperty({ type: [TaskDto], required: false })
  subtasks?: TaskDto[];

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

  /** Same as creator (workspace member id). */
  @ApiProperty({ required: false })
  reporterWorkspaceMemberId?: string;

  @ApiProperty({ required: false })
  reporterUserId?: string;

  @ApiProperty({ required: false })
  reporterName?: string;

  @ApiProperty({ required: false })
  reporterEmail?: string;

  @ApiProperty({ type: [TaskAssigneeDto], required: false })
  assignees?: TaskAssigneeDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
