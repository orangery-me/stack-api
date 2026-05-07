import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateCanvasVisibilityDto {
  @ApiProperty({
    description: 'Chế độ hiển thị của canvas',
    enum: ['private', 'shared', 'public-workspace'],
  })
  @IsIn(['private', 'shared', 'public-workspace'])
  visibility: 'private' | 'shared' | 'public-workspace';
}
