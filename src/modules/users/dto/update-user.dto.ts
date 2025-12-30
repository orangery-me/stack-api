import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { StatusEnum } from '@Constant/enums';
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
    enum: StatusEnum,
    example: StatusEnum.ACTIVE,
  })
  @Expose()
  @IsOptional()
  @IsEnum(StatusEnum, { message: 'Trạng thái không hợp lệ' })
  status?: StatusEnum;

  @ApiProperty({
    description: 'Số điện thoại',
    example: '0123456789',
    minLength: 10,
    maxLength: 10,
  })
  @Expose()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @Length(10, 10, { message: 'Số điện thoại phải có đúng 10 số' })
  @Matches(/^[0-9]+$/, { message: 'Số điện thoại chỉ được chứa số' })
  phone: string;

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

  @ApiProperty({
    description: 'Số CMND/CCCD',
    example: '123456789012',
    minLength: 9,
    maxLength: 12,
  })
  @Expose()
  @IsNotEmpty({ message: 'Số CMND/CCCD không được để trống' })
  @IsString({ message: 'Số CMND/CCCD phải là chuỗi' })
  @Length(9, 12, { message: 'Số CMND/CCCD phải từ 9 đến 12 số' })
  @Matches(/^[0-9]+$/, { message: 'Số CMND/CCCD chỉ được chứa số' })
  identityId: string;
}
