import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  AgentClientService,
  AskAgentRequest,
  AskAgentResponse,
  AskAgentStreamChunk,
  CanvasWriteRequest,
  CanvasSessionMessageRequest,
  CanvasApplyActionRequest,
  CanvasApplyActionResponse,
  TaskSessionMessageRequest,
  TaskApplyActionRequest,
  TaskApplyActionResponse,
  SendMessageRequest,
  SendMessageResponse,
  UpdateMessageActionStatusRequest,
  ChatMessageDto,
  SessionDto,
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

  async updateMessageActionStatus(data: UpdateMessageActionStatusRequest): Promise<ChatMessageDto> {
    return this.agentClientService.updateMessageActionStatus(data);
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

  canvasSessionMessageStream(data: CanvasSessionMessageRequest): Observable<AskAgentStreamChunk> {
    return this.agentClientService.canvasSessionMessageStream(data);
  }

  async canvasApplyAction(data: CanvasApplyActionRequest): Promise<CanvasApplyActionResponse> {
    return this.agentClientService.canvasApplyAction(data);
  }

  taskSessionMessageStream(data: TaskSessionMessageRequest): Observable<AskAgentStreamChunk> {
    return this.agentClientService.taskSessionMessageStream(data);
  }

  async taskApplyAction(data: TaskApplyActionRequest): Promise<TaskApplyActionResponse> {
    return this.agentClientService.taskApplyAction(data);
  }
}
