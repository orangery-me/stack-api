import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { UserStatusEnum, UserRoleEnum } from '@Constant/enums';

export class UserDto {
  @ApiProperty({
    description: 'Email của người dùng',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({
    description: 'Số điện thoại',
    example: '0123456789',
    minLength: 10,
    maxLength: 10,
  })
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @Length(10, 10, { message: 'Số điện thoại phải có đúng 10 số' })
  @Matches(/^[0-9]+$/, { message: 'Số điện thoại chỉ được chứa số' })
  phone: string;

  @ApiProperty({
    description: 'Trạng thái tài khoản',
    enum: UserStatusEnum,
    example: UserStatusEnum.ACTIVE,
  })
  @IsEnum(UserStatusEnum, { message: 'Trạng thái không hợp lệ' })
  status: UserStatusEnum;

  @ApiProperty({
    description: 'Vai trò người dùng',
    enum: UserRoleEnum,
    example: UserRoleEnum.USER,
  })
  @IsEnum(UserRoleEnum, { message: 'Vai trò không hợp lệ' })
  role: UserRoleEnum;

  @ApiProperty({
    description: 'Họ và tên',
    example: 'Nguyễn Văn A',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: 'Tên phải là chuỗi' })
  @Length(2, 50, { message: 'Tên phải từ 2 đến 50 ký tự' })
  name: string;

  @ApiPropertyOptional({
    description: 'Mật khẩu (chỉ hiển thị khi cần thiết)',
    example: 'password123',
    minLength: 6,
  })
  @IsOptional()
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @Length(6, 100, { message: 'Mật khẩu phải từ 6 đến 100 ký tự' })
  password?: string;

  @ApiPropertyOptional({
    description: 'Ngày sinh',
    example: '1990-01-01T00:00:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  @IsOptional()
  dateOfBirth?: Date;

  @ApiPropertyOptional({
    description: 'Địa chỉ',
    example: '123 Đường ABC, Quận XYZ, TP.HCM',
    maxLength: 200,
  })
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi' })
  @Length(0, 200, { message: 'Địa chỉ không được quá 200 ký tự' })
  address?: string;

  @ApiProperty({
    description: 'Số CMND/CCCD',
    example: '123456789012',
    minLength: 9,
    maxLength: 12,
  })
  @IsString({ message: 'Số CMND/CCCD phải là chuỗi' })
  @Length(9, 12, { message: 'Số CMND/CCCD phải từ 9 đến 12 số' })
  @Matches(/^[0-9]+$/, { message: 'Số CMND/CCCD chỉ được chứa số' })
  identityId: string;

  @ApiPropertyOptional({
    description: 'URL ảnh đại diện',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString({ message: 'Avatar phải là chuỗi' })
  avatar?: string;

  @ApiPropertyOptional({
    description: 'Refresh token (chỉ sử dụng nội bộ)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
