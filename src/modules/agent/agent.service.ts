import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  AgentClientService,
  AskAgentRequest,
  AskAgentResponse,
  AskAgentStreamChunk,
  CanvasWriteRequest,
  SendMessageRequest,
  SendMessageResponse,
  SessionDto,
  ChatMessageDto,
  MessageListDto,
} from '../agent-client/agent-client.service';

@Injectable()
export class AgentService {
  constructor(private readonly agentClientService: AgentClientService) {}

  // ---- Legacy ----

  async askAgent(data: AskAgentRequest): Promise<AskAgentResponse> {
    return this.agentClientService.askAgent(data);
  }

  askAgentStream(data: AskAgentRequest): Observable<AskAgentStreamChunk> {
    return this.agentClientService.askAgentStream(data);
  }

  // ---- Sessions ----

  async updateSession(userId: string, sessionId: string, title: string): Promise<SessionDto> {
    return this.agentClientService.updateSession(userId, sessionId, title);
  }

  async getOrCreateActiveSession(userId: string): Promise<SessionDto> {
    return this.agentClientService.getOrCreateActiveSession(userId);
  }

  async listSessions(userId: string): Promise<SessionDto[]> {
    return this.agentClientService.listSessions(userId);
  }

  async createSession(userId: string, title?: string): Promise<SessionDto> {
    return this.agentClientService.createSession(userId, title);
  }

  async getSessionMessages(userId: string, sessionId: string, page: number, size: number): Promise<MessageListDto> {
    return this.agentClientService.getSessionMessages(userId, sessionId, page, size);
  }

  async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
    return this.agentClientService.sendMessage(data);
  }

  sendMessageStream(data: SendMessageRequest): Observable<AskAgentStreamChunk> {
    return this.agentClientService.sendMessageStream(data);
  }

  canvasWriteStream(data: CanvasWriteRequest): Observable<AskAgentStreamChunk> {
    return this.agentClientService.canvasWriteStream(data);
  }
}
