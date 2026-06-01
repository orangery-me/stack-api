import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface StartSubtitleSessionPayload {
  callId: string;
  channelId: string;
  livekitRoomName: string;
  livekitUrl: string;
  livekitToken: string;
  language?: string;
}

@Injectable()
export class SubtitleClientService {
  private readonly logger = new Logger(SubtitleClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async startSession(payload: StartSubtitleSessionPayload): Promise<boolean> {
    const baseUrl = this.configService.get<string>('WHISPER_SERVICE_URL');
    if (!baseUrl) {
      this.logger.warn('WHISPER_SERVICE_URL is not configured; realtime subtitles are disabled');
      return false;
    }

    this.logger.log(`Starting subtitle session call=${payload.callId} room=${payload.livekitRoomName} service=${baseUrl}`);
    try {
      await axios.post(
        `${baseUrl.replace(/\/$/, '')}/sessions/start`,
        {
          call_id: payload.callId,
          channel_id: payload.channelId,
          livekit_room_name: payload.livekitRoomName,
          livekit_url: payload.livekitUrl,
          livekit_token: payload.livekitToken,
          stack_api_url: this.getStackApiUrl(),
          language: payload.language || 'vi',
        },
        {
          timeout: 5000,
          headers: this.internalHeaders(),
        },
      );
      this.logger.log(`Subtitle session start request accepted call=${payload.callId}`);
      return true;
    } catch (error: any) {
      if (error?.response?.status === 409) {
        this.logger.log(`Subtitle session already running call=${payload.callId}`);
        return true;
      }
      throw error;
    }
  }

  async stopSession(callId: string): Promise<void> {
    const baseUrl = this.configService.get<string>('WHISPER_SERVICE_URL');
    if (!baseUrl) return;

    this.logger.log(`Stopping subtitle session call=${callId} service=${baseUrl}`);
    await axios.post(
      `${baseUrl.replace(/\/$/, '')}/sessions/${callId}/stop`,
      {},
      {
        timeout: 5000,
        headers: this.internalHeaders(),
      },
    );
    this.logger.log(`Subtitle session stop request accepted call=${callId}`);
  }

  private internalHeaders(): Record<string, string> {
    return {
      'x-internal-secret':
        this.configService.get<string>('INTERNAL_SECRET') ||
        this.configService.get<string>('CANVAS_COLLAB_SECRET') ||
        '',
    };
  }

  private getStackApiUrl(): string {
    const configuredUrl = this.configService.get<string>('STACK_API_INTERNAL_URL');
    if (configuredUrl) return configuredUrl.replace(/\/$/, '');

    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:8105').replace(/\/$/, '');
    return `${appUrl}/api`;
  }
}
