import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsInt, Min } from 'class-validator';

export class UpdateTaskListDto {
  @ApiProperty({ required: false, description: 'Task list name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false, description: 'Position/order of the tab' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
