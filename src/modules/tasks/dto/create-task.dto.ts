import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  MaxLength,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { TaskStatus, TaskPriority } from '@app/entities/task/task.entity';
import { TaskAttachmentInputDto } from './task-attachment.dto';

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @ApiProperty({ required: false, description: 'Task description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ required: false, enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ required: false, description: 'Due date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ required: false, description: 'Workspace member IDs to assign', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  @ApiProperty({ required: false, description: 'Parent task ID (single-level subtasks only)', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  parentTaskId?: string | null;

  @ApiProperty({ required: false, type: () => [TaskAttachmentInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskAttachmentInputDto)
  @ArrayMaxSize(50)
  attachments?: TaskAttachmentInputDto[];
}
