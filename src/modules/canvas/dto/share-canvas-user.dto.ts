import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn } from 'class-validator';

export class ShareCanvasWithUserDto {
  @ApiProperty({
    description: 'Email của user trong workspace',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({
    description: 'Quyền share cho user',
    enum: ['viewer', 'editor'],
  })
  @IsIn(['viewer', 'editor'])
  role: 'viewer' | 'editor';
}
