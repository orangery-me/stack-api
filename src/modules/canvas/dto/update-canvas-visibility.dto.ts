import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class UpdateCanvasVisibilityDto {
  @ApiProperty({
    description: 'Chế độ hiển thị của canvas',
    enum: ['private', 'shared', 'public-workspace'],
  })
  @IsIn(['private', 'shared', 'public-workspace'])
  visibility: 'private' | 'shared' | 'public-workspace';

  @ApiProperty({
    description: 'Workspace-wide access role when visibility is public-workspace',
    enum: ['viewer', 'editor'],
    required: false,
    default: 'viewer',
  })
  @IsOptional()
  @IsIn(['viewer', 'editor'])
  role?: 'viewer' | 'editor';
}
