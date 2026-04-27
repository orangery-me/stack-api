import { Injectable } from '@nestjs/common';

@Injectable()
export class InAppAdapter {
  async deliver(): Promise<boolean> {
    return true;
  }
}
