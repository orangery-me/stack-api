import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspacePlanEnum } from '@Constant/enums';

export class WorkspaceDto {
  @ApiProperty({
    description: 'ID của workspace',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Tên workspace',
    example: 'My Workspace',
  })
  name: string;

  @ApiProperty({
    description: 'Slug của workspace',
    example: 'my-workspace',
  })
  slug: string;

  @ApiProperty({
    description: 'ID của owner',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  ownerId: string;

  @ApiPropertyOptional({
    description: 'Tên của owner',
    example: 'John Doe',
  })
  ownerName?: string;

  @ApiPropertyOptional({
    description: 'Email của owner',
    example: 'john@example.com',
  })
  ownerEmail?: string;

  @ApiProperty({
    description: 'Gói dịch vụ',
    enum: WorkspacePlanEnum,
    example: WorkspacePlanEnum.FREE,
  })
  plan?: WorkspacePlanEnum;

  @ApiPropertyOptional({
    description: 'Settings của workspace',
    example: { canvas_enabled: true, task_enabled: false },
  })
  settings?: Record<string, any>;

  @ApiProperty({
    description: 'Ngày tạo',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Vai trò của user hiện tại trong workspace',
    example: 'admin',
  })
  currentUserRole?: string;
}
