import { ApiProperty } from '@nestjs/swagger';

export class CanvasCollabTokenDto {
  @ApiProperty()
  token: string;

  @ApiProperty({ example: '10m' })
  expiresIn: string;

  @ApiProperty({ enum: ['viewer', 'editor'] })
  role: 'viewer' | 'editor';

  @ApiProperty()
  readOnly: boolean;
}
