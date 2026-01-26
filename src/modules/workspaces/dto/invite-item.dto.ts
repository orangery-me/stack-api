import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { WorkspaceRoleNameEnum } from '@Constant/enums';

export class InviteItemDto {
  @ApiProperty({
    description: 'Email of the invited user',
    example: 'user@example.com',
    format: 'email',
  })
  @IsNotEmpty({ message: 'Email must not be empty' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({
    description: 'Role name (owner/admin/member)',
    enum: WorkspaceRoleNameEnum,
    example: WorkspaceRoleNameEnum.MEMBER,
  })
  @IsNotEmpty({ message: 'Role must not be empty' })
  @IsEnum(WorkspaceRoleNameEnum, { message: 'Role is not valid' })
  role: WorkspaceRoleNameEnum;
}
