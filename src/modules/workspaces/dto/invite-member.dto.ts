import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsUUID } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email of the invited user',
    example: 'user@example.com',
    format: 'email',
  })
  @IsNotEmpty({ message: 'Email must not be empty' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({
    description: 'Role ID in the workspace',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Role ID must not be empty' })
  @IsUUID('4', { message: 'Role ID must be a valid UUID' })
  roleId: string;
}
