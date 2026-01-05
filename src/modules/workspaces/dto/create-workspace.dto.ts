import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
import { WorkspacePlanEnum } from '@Constant/enums';

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
    description: 'Slug của workspace (dùng cho URL)',
    example: 'my-workspace',
    minLength: 2,
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Slug không được để trống' })
  @IsString({ message: 'Slug phải là chuỗi' })
  @Length(2, 255, { message: 'Slug phải từ 2 đến 255 ký tự' })
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug chỉ được chứa chữ thường, số và dấu gạch ngang' })
  slug: string;

  @ApiPropertyOptional({
    description: 'Gói dịch vụ',
    enum: WorkspacePlanEnum,
    example: WorkspacePlanEnum.FREE,
    default: WorkspacePlanEnum.FREE,
  })
  @IsOptional()
  plan?: WorkspacePlanEnum;
}
