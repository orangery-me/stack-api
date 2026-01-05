import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';

export class WorkspaceMemberDto {
  @ApiProperty({
    description: 'ID của workspace member',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'ID của workspace',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  workspaceId: string;

  @ApiProperty({
    description: 'ID của user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Email của user',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Tên của user',
    example: 'Nguyễn Văn A',
  })
  name: string;

  @ApiProperty({
    description: 'Avatar của user',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatar?: string;

  @ApiProperty({
    description: 'ID của role',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  roleId: string;

  @ApiProperty({
    description: 'Tên của role',
    example: 'owner',
  })
  roleName: string;

  @ApiProperty({
    description: 'Permissions của role',
    example: { 'channel:create': true, 'channel:delete': false },
  })
  permissions?: Record<string, any>;

  @ApiProperty({
    description: 'Trạng thái của member',
    enum: WorkspaceMemberStatusEnum,
    example: WorkspaceMemberStatusEnum.ACTIVE,
  })
  status: WorkspaceMemberStatusEnum;

  @ApiProperty({
    description: 'Ngày tham gia',
    example: '2024-01-01T00:00:00.000Z',
  })
  joinedAt: Date;
}
