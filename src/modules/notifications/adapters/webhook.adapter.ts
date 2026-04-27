import { Injectable } from '@nestjs/common';

@Injectable()
export class WebhookAdapter {
  async deliver(): Promise<boolean> {
    // Placeholder for phase 2 outbound webhook delivery.
    return true;
  }
}
