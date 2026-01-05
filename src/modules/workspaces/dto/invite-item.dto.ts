import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { WorkspaceRoleNameEnum } from '@Constant/enums';

export class InviteItemDto {
  @ApiProperty({
    description: 'Email của người được mời',
    example: 'user@example.com',
    format: 'email',
  })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({
    description: 'Tên của role (owner/admin/member)',
    enum: WorkspaceRoleNameEnum,
    example: WorkspaceRoleNameEnum.MEMBER,
  })
  @IsNotEmpty({ message: 'Role không được để trống' })
  @IsEnum(WorkspaceRoleNameEnum, { message: 'Role không hợp lệ' })
  role: WorkspaceRoleNameEnum;
}
