import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { UserStatusEnum, UserRoleEnum } from '@Constant/enums';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    description: 'Email của người dùng',
    example: 'user@example.com',
    format: 'email',
  })
  @Expose()
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({
    description: 'Họ và tên',
    example: 'Nguyễn Văn A',
    minLength: 2,
    maxLength: 50,
  })
  @Expose()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @IsString({ message: 'Tên phải là chuỗi' })
  @Length(2, 50, { message: 'Tên phải từ 2 đến 50 ký tự' })
  name: string;

  @ApiPropertyOptional({
    description: 'Trạng thái tài khoản',
    enum: UserStatusEnum,
    example: UserStatusEnum.ACTIVE,
  })
  @Expose()
  @IsOptional()
  @IsEnum(UserStatusEnum, { message: 'Trạng thái không hợp lệ' })
  status?: UserStatusEnum;

  @ApiPropertyOptional({
    description: 'Vai trò người dùng',
    enum: UserRoleEnum,
    example: UserRoleEnum.USER,
  })
  @Expose()
  @IsOptional()
  @IsEnum(UserRoleEnum, { message: 'Vai trò không hợp lệ' })
  role?: UserRoleEnum;

  @ApiPropertyOptional({
    description: 'Số điện thoại',
    example: '0123456789',
  })
  @Expose()
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @Matches(/^[0-9]+$/, { message: 'Số điện thoại chỉ được chứa số' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ',
    example: '123 Đường ABC, Quận XYZ, TP.HCM',
    maxLength: 200,
  })
  @Expose()
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi' })
  @Length(0, 200, { message: 'Địa chỉ không được quá 200 ký tự' })
  address?: string;

  @ApiPropertyOptional({
    description: 'Ngày sinh',
    example: '1990-01-01',
    type: 'string',
    format: 'date',
  })
  @Expose()
  @IsOptional()
  dateOfBirth?: Date;
}
