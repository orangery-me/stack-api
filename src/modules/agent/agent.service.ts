import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  AgentClientService,
  AskAgentRequest,
  AskAgentResponse,
  AskAgentStreamChunk,
} from '../agent-client/agent-client.service';

@Injectable()
export class AgentService {
  constructor(private readonly agentClientService: AgentClientService) {}

  async askAgent(data: AskAgentRequest): Promise<AskAgentResponse> {
    return this.agentClientService.askAgent(data);
  }

  askAgentStream(data: AskAgentRequest): Observable<AskAgentStreamChunk> {
    return this.agentClientService.askAgentStream(data);
  }
}
