import { Injectable } from '@nestjs/common';
import { EmailService } from '../../email/email.service';

@Injectable()
export class NotificationEmailAdapter {
  constructor(private readonly emailService: EmailService) {}

  async deliver(type: string, payload: Record<string, any>): Promise<boolean> {
    if (type === 'workspace.invited') {
      return this.emailService.sendWorkspaceInviteEmail(
        payload.email,
        payload.inviterName || 'Someone',
        payload.workspaceName || 'Workspace',
        payload.roleName || 'member',
        payload.inviteToken
      );
    }

    return true;
  }
}
