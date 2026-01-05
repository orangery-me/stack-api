import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsUUID } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email của người được mời',
    example: 'user@example.com',
    format: 'email',
  })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({
    description: 'ID của role trong workspace',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Role ID không được để trống' })
  @IsUUID('4', { message: 'Role ID phải là UUID hợp lệ' })
  roleId: string;
}
