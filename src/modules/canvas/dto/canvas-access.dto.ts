import { ApiProperty } from '@nestjs/swagger';

export class CanvasAccessDto {
  @ApiProperty({ enum: ['viewer', 'editor'] })
  role: 'viewer' | 'editor';

  @ApiProperty()
  canEdit: boolean;

  @ApiProperty()
  readOnly: boolean;
}
