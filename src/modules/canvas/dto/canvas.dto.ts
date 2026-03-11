import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CanvasDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({
    description: 'Trạng thái của canvas',
    example: 'active',
  })
  status: string;

  @ApiProperty()
  createdById: string;

  @ApiPropertyOptional()
  updatedById?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  ownerId: string;

  @ApiProperty({
    description: 'Chế độ hiển thị của canvas',
    example: 'private',
  })
  visibility: string;

  @ApiPropertyOptional({
    description: 'Version đã được publish gần nhất',
  })
  lastPublishedVersion?: number | null;

  @ApiPropertyOptional({
    description: 'Thời điểm auto-save gần nhất',
  })
  lastAutoSaveAt?: Date | null;

  @ApiPropertyOptional({
    description: 'User hiện tại có quyền edit không',
  })
  canEdit?: boolean;

  @ApiPropertyOptional({
    description: 'Canvas có đang được share hay không',
  })
  isShared?: boolean;
}

