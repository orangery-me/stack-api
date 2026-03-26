import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AgentResponseDto {
  @ApiProperty({
    description: 'Agent response',
    example: 'Hello, world!',
  })
  @IsNotEmpty()
  @IsString()
  response: string;
}
