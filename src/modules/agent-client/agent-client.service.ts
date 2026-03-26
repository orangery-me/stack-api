import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom } from 'rxjs';

export interface AskAgentRequest {
  message: string;
  provider?: string; // "openai" | "gemini"
  model?: string;   // e.g. "gpt-4o", "gemini-1.5-pro"
}

export interface AskAgentResponse {
  response: string;
}

export interface AskAgentStreamChunk {
  chunk: string;
  done: boolean;
}

interface AgentServiceClient {
  askAgent(data: AskAgentRequest): Observable<AskAgentResponse>;
  askAgentStream(data: AskAgentRequest): Observable<AskAgentStreamChunk>;
}

@Injectable()
export class AgentClientService implements OnModuleInit {
  private agentService: AgentServiceClient;

  constructor(@Inject('AGENT_PACKAGE') private readonly agentClient: ClientGrpc) {}

  onModuleInit() {
    this.agentService = this.agentClient.getService<AgentServiceClient>('AgentService');
  }

  async askAgent(data: AskAgentRequest): Promise<AskAgentResponse> {
    try {
      const response = await lastValueFrom<AskAgentResponse>(
        this.agentService.askAgent({
          message: data.message,
          provider: data.provider,
          model: data.model,
        })
      );

      return response;
    } catch (error: any) {
      console.error('[AgentClientService] Error calling agent:', error?.message || error);
      throw error;
    }
  }

  askAgentStream(data: AskAgentRequest): Observable<AskAgentStreamChunk> {
    return this.agentService.askAgentStream({
      message: data.message,
      provider: data.provider,
      model: data.model,
    });
  }
}
