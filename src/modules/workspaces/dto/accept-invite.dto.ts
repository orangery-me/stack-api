import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty({
    description: 'Token used to accept the invite',
    example: 'abc123def456...',
  })
  @IsNotEmpty({ message: 'Token must not be empty' })
  @IsString({ message: 'Token must be a string' })
  token: string;
}
