import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceMemberStatusEnum } from '@Constant/enums';

export class WorkspaceMemberDto {
  @ApiProperty({
    description: 'Workspace member ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Workspace ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  workspaceId: string;

  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User avatar',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatar?: string;

  @ApiProperty({
    description: 'Role ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  roleId: string;

  @ApiProperty({
    description: 'Role name',
    example: 'owner',
  })
  roleName: string;

  @ApiProperty({
    description: 'Role permissions',
    example: { 'channel:create': true, 'channel:delete': false },
  })
  permissions?: Record<string, any>;

  @ApiProperty({
    description: 'Member status',
    enum: WorkspaceMemberStatusEnum,
    example: WorkspaceMemberStatusEnum.ACTIVE,
  })
  status: WorkspaceMemberStatusEnum;

  @ApiProperty({
    description: 'Joined date',
    example: '2024-01-01T00:00:00.000Z',
  })
  joinedAt: Date;
}
