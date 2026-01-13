import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { WorkspacesService } from './workspaces.service';

interface VerifyMembershipRequest {
  userId: string;
  workspaceId: string;
}

interface VerifyMembershipResponse {
  isValid: boolean;
  message: string;
}

@Controller()
export class WorkspacesGrpcController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @GrpcMethod('WorkspaceService', 'VerifyMembership')
  async verifyMembership(data: VerifyMembershipRequest): Promise<VerifyMembershipResponse> {
    try {
      await this.workspacesService.getWorkspaceById(data.workspaceId, data.userId);

      return {
        isValid: true,
        message: 'User is a member of the workspace',
      };
    } catch (error: any) {
      return {
        isValid: false,
        message: error?.message || 'User is not a member of the workspace',
      };
    }
  }
}
