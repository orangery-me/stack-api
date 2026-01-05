import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkspacePlanEnum } from '@Constant/enums';
import { InviteItemDto } from './invite-item.dto';

export class CreateWorkspaceDto {
  @ApiProperty({
    description: 'Tên workspace',
    example: 'My Workspace',
    minLength: 2,
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Tên workspace không được để trống' })
  @IsString({ message: 'Tên workspace phải là chuỗi' })
  @Length(2, 255, { message: 'Tên workspace phải từ 2 đến 255 ký tự' })
  name: string;

  @ApiProperty({
    description: 'Tên hiển thị của bạn trong workspace này',
    example: 'John Doe',
    minLength: 2,
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Tên hiển thị không được để trống' })
  @IsString({ message: 'Tên hiển thị phải là chuỗi' })
  @Length(2, 50, { message: 'Tên hiển thị phải từ 2 đến 50 ký tự' })
  displayName: string;

  @ApiPropertyOptional({
    description: 'Danh sách người được mời vào workspace',
    type: [InviteItemDto],
  })
  @IsOptional()
  @IsArray({ message: 'Invites phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => InviteItemDto)
  invites?: InviteItemDto[];

  @ApiPropertyOptional({
    description: 'Gói dịch vụ',
    enum: WorkspacePlanEnum,
    example: WorkspacePlanEnum.FREE,
    default: WorkspacePlanEnum.FREE,
  })
  @IsOptional()
  plan?: WorkspacePlanEnum;
}
