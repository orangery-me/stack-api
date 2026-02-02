import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCanvasDto {
  @ApiPropertyOptional({
    description: 'Tiêu đề canvas; nếu rỗng sẽ dùng "New page"',
    example: 'Sprint planning notes',
  })
  @IsOptional()
  @IsString()
  title?: string;
}
