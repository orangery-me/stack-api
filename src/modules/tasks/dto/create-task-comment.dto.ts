import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTaskCommentDto {
  @ApiProperty({ description: 'Comment content', maxLength: 4000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;

  @ApiProperty({ required: false, description: 'Mentioned workspace member IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mentions?: string[];

  @ApiProperty({ required: false, description: 'Parent comment ID for reply thread' })
  @IsOptional()
  @IsUUID('4')
  parentCommentId?: string;
}
