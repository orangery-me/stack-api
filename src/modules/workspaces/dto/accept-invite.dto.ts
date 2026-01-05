import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty({
    description: 'Token để accept invite',
    example: 'abc123def456...',
  })
  @IsNotEmpty({ message: 'Token không được để trống' })
  @IsString({ message: 'Token phải là chuỗi' })
  token: string;
}
