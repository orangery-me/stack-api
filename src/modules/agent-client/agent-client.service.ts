import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';

// ---- Legacy ----

export interface AskAgentRequest {
  message: string;
  provider?: string;
  model?: string;
}

export interface AskAgentResponse {
  response: string;
}

export interface AskAgentStreamChunk {
  chunk: string;
  done: boolean;
}

// ---- Session ----

export interface SessionDto {
  id: string;
  userId: string;
  title: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDto {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface MessageListDto {
  messages: ChatMessageDto[];
  total: number;
  hasMore: boolean;
}

export interface SendMessageRequest {
  userId: string;
  sessionId: string;
  message: string;
  provider?: string;
  model?: string;
}

export interface SendMessageResponse {
  response: string;
  assistantMessage: ChatMessageDto;
}

// ---- gRPC service interface ----

interface AgentServiceClient {
  // Legacy
  askAgent(data: AskAgentRequest): Observable<AskAgentResponse>;
  askAgentStream(data: AskAgentRequest): Observable<AskAgentStreamChunk>;

  // Sessions
  updateSession(data: { userId: string; sessionId: string; title: string }): Observable<SessionDto>;
  getOrCreateActiveSession(data: { userId: string }): Observable<SessionDto>;
  listSessions(data: { userId: string }): Observable<{ sessions: SessionDto[] }>;
  createSession(data: { userId: string; title?: string }): Observable<SessionDto>;

  // Messages
  getSessionMessages(data: {
    userId: string;
    sessionId: string;
    page?: number;
    size?: number;
  }): Observable<MessageListDto>;

  // Send
  sendMessage(data: SendMessageRequest): Observable<SendMessageResponse>;
  sendMessageStream(data: SendMessageRequest): Observable<AskAgentStreamChunk>;
}

@Injectable()
export class AgentClientService implements OnModuleInit {
  private agentService: AgentServiceClient;

  constructor(@Inject('AGENT_PACKAGE') private readonly agentClient: ClientGrpc) {}

  onModuleInit() {
    this.agentService = this.agentClient.getService<AgentServiceClient>('AgentService');
  }

  // ---- Legacy ----

  async askAgent(data: AskAgentRequest): Promise<AskAgentResponse> {
    try {
      return await lastValueFrom<AskAgentResponse>(
        this.agentService.askAgent({ message: data.message, provider: data.provider, model: data.model })
      );
    } catch (error: any) {
      console.error('[AgentClientService] Error calling agent:', error?.message || error);
      throw error;
    }
  }

  askAgentStream(data: AskAgentRequest): Observable<AskAgentStreamChunk> {
    return this.agentService.askAgentStream({ message: data.message, provider: data.provider, model: data.model });
  }

  // ---- Sessions ----

  async updateSession(userId: string, sessionId: string, title: string): Promise<SessionDto> {
    return lastValueFrom(this.agentService.updateSession({ userId, sessionId, title }));
  }

  async getOrCreateActiveSession(userId: string): Promise<SessionDto> {
    return lastValueFrom(this.agentService.getOrCreateActiveSession({ userId }));
  }

  async listSessions(userId: string): Promise<SessionDto[]> {
    const result = await lastValueFrom(this.agentService.listSessions({ userId }));
    return result.sessions ?? [];
  }

  async createSession(userId: string, title?: string): Promise<SessionDto> {
    return lastValueFrom(this.agentService.createSession({ userId, title }));
  }

  async getSessionMessages(userId: string, sessionId: string, page = 1, size = 50): Promise<MessageListDto> {
    return lastValueFrom(this.agentService.getSessionMessages({ userId, sessionId, page, size }));
  }

  async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
    return lastValueFrom(this.agentService.sendMessage(data));
  }

  sendMessageStream(data: SendMessageRequest): Observable<AskAgentStreamChunk> {
    return this.agentService.sendMessageStream(data);
  }
}
