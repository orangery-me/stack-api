import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CanvasVersionDto {
  @ApiProperty()
  version: number;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiPropertyOptional()
  savedById?: string | null;

  @ApiProperty()
  savedAt: Date;

  @ApiPropertyOptional({
    description: 'Nội dung snapshot (thường chỉ trả về khi xem chi tiết 1 version)',
    type: 'object',
  })
  content?: any;
}

