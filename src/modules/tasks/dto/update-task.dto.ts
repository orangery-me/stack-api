import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { TaskStatus, TaskPriority } from '@app/entities/task/task.entity';
import { TaskAttachmentInputDto } from './task-attachment.dto';

export class UpdateTaskDto {
  @ApiProperty({ required: false, description: 'Task title', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiProperty({ required: false, description: 'Task description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ required: false, enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ required: false, description: 'Due date (ISO 8601), send null to clear' })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiProperty({ required: false, type: () => [TaskAttachmentInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskAttachmentInputDto)
  @ArrayMaxSize(50)
  attachments?: TaskAttachmentInputDto[];
}
