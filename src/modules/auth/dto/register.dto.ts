import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Email của người dùng',
    example: 'user@example.com',
    format: 'email',
  })
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({
    description: 'Số điện thoại',
    example: '0123456789',
    minLength: 10,
    maxLength: 10,
  })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @Length(10, 10, { message: 'Số điện thoại phải có đúng 10 số' })
  @Matches(/^[0-9]+$/, { message: 'Số điện thoại chỉ được chứa số' })
  phone: string;

  @ApiProperty({
    description: 'Mật khẩu',
    example: 'password123',
    minLength: 6,
  })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @Length(6, 100, { message: 'Mật khẩu phải từ 6 đến 100 ký tự' })
  password: string;

  @ApiProperty({
    description: 'Họ và tên',
    example: 'Nguyễn Văn A',
    minLength: 2,
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @IsString({ message: 'Tên phải là chuỗi' })
  @Length(2, 50, { message: 'Tên phải từ 2 đến 50 ký tự' })
  name: string;

  @ApiProperty({
    description: 'Số CMND/CCCD',
    example: '123456789012',
    minLength: 9,
    maxLength: 12,
  })
  @IsNotEmpty({ message: 'Số CMND/CCCD không được để trống' })
  @IsString({ message: 'Số CMND/CCCD phải là chuỗi' })
  @Length(9, 12, { message: 'Số CMND/CCCD phải từ 9 đến 12 số' })
  @Matches(/^[0-9]+$/, { message: 'Số CMND/CCCD chỉ được chứa số' })
  identityId: string;
}
