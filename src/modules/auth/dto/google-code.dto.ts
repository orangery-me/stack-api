import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleCodeDto {
  @ApiProperty({
    description: 'Authorization code từ Google OAuth',
    example: '4/0AeanS...',
  })
  @IsNotEmpty({ message: 'Code không được để trống' })
  @IsString({ message: 'Code phải là chuỗi' })
  code: string;

  @ApiProperty({
    description: 'State để chống CSRF',
    example: 'random_state_string',
  })
  @IsNotEmpty({ message: 'State không được để trống' })
  @IsString({ message: 'State phải là chuỗi' })
  state: string;
}
