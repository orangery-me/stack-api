import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject, IsString, Length } from 'class-validator';

export class UpdateWorkspaceRoleDto {
  @ApiPropertyOptional({
    description: 'Workspace role name',
    example: 'Moderator',
    minLength: 2,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'Role name must be a string' })
  @Length(2, 50, { message: 'Role name must be between 2 and 50 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Workspace role permissions',
    example: {
      actions: {
        'channel:create': true,
        'message:create': true,
      },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Permissions must be an object' })
  permissions?: Record<string, any>;
}
