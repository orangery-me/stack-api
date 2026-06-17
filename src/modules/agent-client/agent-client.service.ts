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
  scopeType?: string;
  scopeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionScopeDto {
  scopeType?: string;
  scopeId?: string;
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

export interface UpdateMessageActionStatusRequest {
  userId: string;
  sessionId: string;
  messageId?: string;
  actionId: string;
  status: string;
  error?: string;
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

export interface CanvasWriteRequest {
  canvasId: string;
  canvasContent: string;
  userRequest: string;
  provider?: string;
  model?: string;
}

export interface CanvasSessionMessageRequest {
  userId: string;
  sessionId: string;
  canvasId: string;
  canvasContent: string;
  message: string;
  provider?: string;
  model?: string;
  mode?: string;
}

export interface CanvasApplyActionRequest {
  canvasId: string;
  actionName: string;
  actionArgsJson: string;
}

export interface CanvasApplyActionResponse {
  ok: boolean;
  resultJson?: string;
  error?: string;
}

export interface TaskSessionMessageRequest {
  userId: string;
  sessionId: string;
  workspaceId: string;
  channelId?: string;
  taskListId?: string;
  canvasId?: string;
  canvasContent?: string;
  message: string;
  provider?: string;
  model?: string;
  canvasTitle?: string;
  sourceCanvasUrl?: string;
  overallDueDate?: string;
  timezone?: string;
}

export interface TaskApplyActionRequest {
  userId: string;
  workspaceId: string;
  channelId?: string;
  taskListId?: string;
  actionName: string;
  actionArgsJson: string;
}

export interface TaskApplyActionResponse {
  ok: boolean;
  resultJson?: string;
  error?: string;
}

// ---- gRPC service interface ----

interface AgentServiceClient {
  // Legacy
  askAgent(data: AskAgentRequest): Observable<AskAgentResponse>;
  askAgentStream(data: AskAgentRequest): Observable<AskAgentStreamChunk>;

  // Sessions
  updateSession(data: { userId: string; sessionId: string; title: string }): Observable<SessionDto>;
  getOrCreateActiveSession(data: { userId: string; scopeType?: string; scopeId?: string }): Observable<SessionDto>;
  listSessions(data: { userId: string; scopeType?: string; scopeId?: string }): Observable<{ sessions: SessionDto[] }>;
  createSession(data: { userId: string; title?: string; scopeType?: string; scopeId?: string }): Observable<SessionDto>;

  // Messages
  getSessionMessages(data: {
    userId: string;
    sessionId: string;
    page?: number;
    size?: number;
    scopeType?: string;
    scopeId?: string;
  }): Observable<MessageListDto>;
  updateMessageActionStatus(data: UpdateMessageActionStatusRequest): Observable<ChatMessageDto>;

  // Send
  sendMessage(data: SendMessageRequest): Observable<SendMessageResponse>;
  sendMessageStream(data: SendMessageRequest): Observable<AskAgentStreamChunk>;

  // Canvas
  canvasWrite(data: {
    canvasId: string;
    canvasContent?: string;
    userRequest: string;
    provider?: string;
    model?: string;
  }): Observable<AskAgentStreamChunk>;
  canvasSessionMessageStream(data: {
    userId: string;
    sessionId: string;
    canvasId: string;
    canvasContent?: string;
    message: string;
    provider?: string;
    model?: string;
    mode?: string;
  }): Observable<AskAgentStreamChunk>;
  canvasApplyAction(data: {
    canvasId: string;
    actionName: string;
    actionArgsJson: string;
  }): Observable<CanvasApplyActionResponse>;
  taskSessionMessageStream(data: {
    userId: string;
    sessionId: string;
    workspaceId: string;
    channelId?: string;
    taskListId?: string;
    canvasId?: string;
    canvasContent?: string;
    message: string;
    provider?: string;
    model?: string;
    canvasTitle?: string;
    sourceCanvasUrl?: string;
    overallDueDate?: string;
    timezone?: string;
  }): Observable<AskAgentStreamChunk>;
  taskApplyAction(data: {
    userId: string;
    workspaceId: string;
    channelId?: string;
    taskListId?: string;
    actionName: string;
    actionArgsJson: string;
  }): Observable<TaskApplyActionResponse>;
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

  async getOrCreateActiveSession(userId: string, scope?: SessionScopeDto): Promise<SessionDto> {
    return lastValueFrom(this.agentService.getOrCreateActiveSession({ userId, ...this.normalizeScope(scope) }));
  }

  async listSessions(userId: string, scope?: SessionScopeDto): Promise<SessionDto[]> {
    const result = await lastValueFrom(this.agentService.listSessions({ userId, ...this.normalizeScope(scope) }));
    return result.sessions ?? [];
  }

  async createSession(userId: string, title?: string, scope?: SessionScopeDto): Promise<SessionDto> {
    return lastValueFrom(this.agentService.createSession({ userId, title, ...this.normalizeScope(scope) }));
  }

  async getSessionMessages(
    userId: string,
    sessionId: string,
    page = 1,
    size = 50,
    scope?: SessionScopeDto
  ): Promise<MessageListDto> {
    return lastValueFrom(
      this.agentService.getSessionMessages({ userId, sessionId, page, size, ...this.normalizeScope(scope) })
    );
  }

  async updateMessageActionStatus(data: UpdateMessageActionStatusRequest): Promise<ChatMessageDto> {
    return lastValueFrom(this.agentService.updateMessageActionStatus(data));
  }

  async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
    return lastValueFrom(this.agentService.sendMessage(data));
  }

  sendMessageStream(data: SendMessageRequest): Observable<AskAgentStreamChunk> {
    return this.agentService.sendMessageStream(data);
  }

  canvasWriteStream(data: CanvasWriteRequest): Observable<AskAgentStreamChunk> {
    return this.agentService.canvasWrite({
      canvasId: data.canvasId,
      canvasContent: data.canvasContent,
      userRequest: data.userRequest,
      provider: data.provider,
      model: data.model,
    });
  }

  canvasSessionMessageStream(data: CanvasSessionMessageRequest): Observable<AskAgentStreamChunk> {
    return this.agentService.canvasSessionMessageStream({
      userId: data.userId,
      sessionId: data.sessionId,
      canvasId: data.canvasId,
      canvasContent: data.canvasContent,
      message: data.message,
      provider: data.provider,
      model: data.model,
      mode: data.mode,
    });
  }

  async canvasApplyAction(data: CanvasApplyActionRequest): Promise<CanvasApplyActionResponse> {
    return lastValueFrom(this.agentService.canvasApplyAction(data));
  }

  taskSessionMessageStream(data: TaskSessionMessageRequest): Observable<AskAgentStreamChunk> {
    return this.agentService.taskSessionMessageStream({
      userId: data.userId,
      sessionId: data.sessionId,
      workspaceId: data.workspaceId,
      channelId: data.channelId,
      taskListId: data.taskListId,
      canvasId: data.canvasId,
      canvasContent: data.canvasContent,
      message: data.message,
      provider: data.provider,
      model: data.model,
      canvasTitle: data.canvasTitle,
      sourceCanvasUrl: data.sourceCanvasUrl,
      overallDueDate: data.overallDueDate,
      timezone: data.timezone,
    });
  }

  async taskApplyAction(data: TaskApplyActionRequest): Promise<TaskApplyActionResponse> {
    return lastValueFrom(this.agentService.taskApplyAction(data));
  }

  private normalizeScope(scope?: SessionScopeDto): { scopeType: string; scopeId?: string } {
    const scopeType = scope?.scopeType === 'canvas' ? 'canvas' : 'general';
    const scopeId = scopeType === 'canvas' ? scope?.scopeId?.trim() : undefined;
    return {
      scopeType,
      ...(scopeId ? { scopeId } : {}),
    };
  }
}
