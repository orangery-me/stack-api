import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Metadata for future file/canvas attaches (no upload pipeline yet). */
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

  @ApiProperty({ required: false })
  fileId?: string;
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
  @MaxLength(255)
  fileId?: string;
}
