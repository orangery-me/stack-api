import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** Attachment metadata stored on Task (canvas link or uploaded file reference). */
export class TaskAttachmentDto {
  @ApiProperty({ required: false })
  id?: string;

  @ApiProperty({ enum: ['canvas', 'file'] })
  type: 'canvas' | 'file';

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  url?: string;

  @ApiProperty({ required: false })
  canvasId?: string;

  @ApiProperty({ required: false, description: 'GCS object path when type is file' })
  fileId?: string;

  @ApiProperty({ required: false })
  size?: number;

  @ApiProperty({ required: false })
  mimeType?: string;
}

export class TaskAttachmentInputDto implements Pick<TaskAttachmentDto, 'type' | 'name'> {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({ enum: ['canvas', 'file'] })
  @IsString()
  @IsIn(['canvas', 'file'])
  type: 'canvas' | 'file';

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  canvasId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  fileId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  size?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimeType?: string;
}
