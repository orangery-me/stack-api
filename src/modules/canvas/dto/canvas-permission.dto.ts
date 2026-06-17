import { ApiProperty } from '@nestjs/swagger';

export class CanvasPermissionItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ['user', 'channel', 'workspace'] })
  type: 'user' | 'channel' | 'workspace';

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

  @ApiProperty({
    description:
      'Workspace-wide link access. Enabled means active workspace members with the link can open the canvas.',
  })
  generalAccess: {
    enabled: boolean;
    role: 'viewer' | 'editor';
  };

  @ApiProperty({ type: [CanvasPermissionItemDto] })
  items: CanvasPermissionItemDto[];
}
