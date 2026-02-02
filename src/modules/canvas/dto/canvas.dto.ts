import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CanvasDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  channelId: string;

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

  @ApiPropertyOptional({
    description: 'Version đã được publish gần nhất',
  })
  lastPublishedVersion?: number | null;

  @ApiPropertyOptional({
    description: 'Thời điểm auto-save gần nhất',
  })
  lastAutoSaveAt?: Date | null;

  @ApiPropertyOptional({
    description: 'Nội dung hiện tại của canvas (optional)',
    type: 'object',
  })
  content?: any;
}

