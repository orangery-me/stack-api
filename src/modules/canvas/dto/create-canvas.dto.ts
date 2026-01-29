import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCanvasDto {
  @ApiProperty({
    description: 'Tiêu đề của canvas',
    example: 'Sprint planning notes',
  })
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  title: string;

  @ApiPropertyOptional({
    description: 'Mô tả ngắn về canvas',
    example: 'Notes cho buổi họp sprint planning tuần này',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Nội dung khởi tạo (block-based JSON)',
    type: 'object',
    example: {
      version: 1,
      blocks: [
        {
          id: 'b1',
          type: 'heading',
          props: { level: 2, text: 'Sprint goals' },
          children: [],
        },
      ],
    },
  })
  @IsOptional()
  initialContent?: any;
}

