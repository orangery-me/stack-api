import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchUsersDto {
  @ApiProperty({
    description: 'Từ khóa tìm kiếm (email hoặc tên)',
    example: 'john@example.com',
  })
  @IsNotEmpty({ message: 'Query không được để trống' })
  @IsString({ message: 'Query phải là chuỗi' })
  query: string;

  @ApiPropertyOptional({
    description: 'Số lượng kết quả tối đa',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit phải là số nguyên' })
  @Min(1, { message: 'Limit phải lớn hơn 0' })
  @Max(50, { message: 'Limit không được vượt quá 50' })
  limit?: number = 10;
}
