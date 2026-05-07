import { ApiProperty } from '@nestjs/swagger';

export class CanvasPermissionItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['user', 'channel'] })
  type: 'user' | 'channel';

  @ApiProperty()
  targetId: string;

  @ApiProperty({ enum: ['viewer', 'editor'] })
  role: 'viewer' | 'editor';

  @ApiProperty({
    description: 'Label hiển thị cho target (vd: email user hoặc tên channel)',
  })
  label: string;
}

export class CanvasPermissionListDto {
  @ApiProperty()
  visibility: string;

  @ApiProperty({ type: [CanvasPermissionItemDto] })
  items: CanvasPermissionItemDto[];
}
