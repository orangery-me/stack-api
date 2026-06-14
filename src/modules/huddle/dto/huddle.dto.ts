import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHuddleDto {
  @ApiProperty({ required: false, description: 'Initial microphone enabled state' })
  @IsOptional()
  @IsBoolean()
  micEnabled?: boolean;

  @ApiProperty({ required: false, description: 'Initial camera enabled state' })
  @IsOptional()
  @IsBoolean()
  cameraEnabled?: boolean;
}

export class JoinHuddleDto {
  @ApiProperty({ description: 'Unique client session ID for multi-device detection' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ required: false, description: 'Initial microphone enabled state' })
  @IsOptional()
  @IsBoolean()
  micEnabled?: boolean;

  @ApiProperty({ required: false, description: 'Initial camera enabled state' })
  @IsOptional()
  @IsBoolean()
  cameraEnabled?: boolean;
}

export class UpdateHuddleStateDto {
  @ApiProperty({ required: false, description: 'Microphone enabled state' })
  @IsOptional()
  @IsBoolean()
  micEnabled?: boolean;

  @ApiProperty({ required: false, description: 'Camera enabled state' })
  @IsOptional()
  @IsBoolean()
  cameraEnabled?: boolean;
}

export class TransferDeviceDto {
  @ApiProperty({ description: 'Pending session ID from multi-device conflict' })
  @IsString()
  @IsNotEmpty()
  pendingSessionId: string;

  @ApiProperty({ description: 'Accept or decline the transfer' })
  @IsBoolean()
  confirm: boolean;
}

export class HuddleCallResponse {
  id: string;
  channelId: string;
  status: string;
  participantCount: number;
  startedAt: Date;
  createdBy: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export class HuddleJoinResponse {
  callId: string;
  livekitRoomName: string;
  livekitToken: string;
  livekitUrl: string;
  participantCount: number;
}

export class HuddleStatusResponse {
  active: boolean;
  call: HuddleCallResponse | null;
  isCurrentUserParticipant?: boolean;
}
