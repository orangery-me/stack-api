import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Injectable()
export class NotificationOutboxWorker {
  private readonly logger = new Logger(NotificationOutboxWorker.name);

  constructor(private readonly dispatcherService: NotificationDispatcherService) {}

  @Cron('*/5 * * * * *')
  async handleDispatch(): Promise<void> {
    const processed = await this.dispatcherService.dispatchPending(100);
    if (processed > 0) {
      this.logger.debug(`Processed ${processed} notification outbox jobs`);
    }
  }
}
