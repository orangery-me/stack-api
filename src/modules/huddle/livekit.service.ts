import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);

  constructor(private readonly configService: ConfigService) {}

  generateRoomName(channelId: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    return `channel_${channelId}_${timestamp}`;
  }

  async generateToken(roomName: string, participantIdentity: string, participantName: string): Promise<string> {
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      this.logger.error('LiveKit API key or secret is not configured');
      throw new Error('LiveKit configuration is missing');
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return await token.toJwt();
  }

  async generateSubscribeOnlyToken(roomName: string, participantIdentity: string, participantName: string): Promise<string> {
    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      this.logger.error('LiveKit API key or secret is not configured');
      throw new Error('LiveKit configuration is missing');
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
    });

    return await token.toJwt();
  }

  getWebSocketUrl(): string {
    return this.configService.get<string>('LIVEKIT_URL', 'ws://localhost:7880');
  }

  getPublicWebSocketUrl(): string {
    return this.configService.get<string>('LIVEKIT_PUBLIC_URL') || this.getWebSocketUrl();
  }
}
