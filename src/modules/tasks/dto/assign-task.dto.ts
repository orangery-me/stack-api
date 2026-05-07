import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTaskDto {
  @ApiProperty({ description: 'Workspace member ID to assign to this task' })
  @IsUUID()
  workspaceMemberId: string;
}
