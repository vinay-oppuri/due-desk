import { Module } from '@nestjs/common';
import { RemindersController } from './reminders.controller.js';
import { RemindersService } from './reminders.service.js';
import { RemindersSchedulerService } from './services/reminders-scheduler.service.js';
import { RemindersOutboxService } from './services/reminders-outbox.service.js';
import { RemindersWatchdogService } from './services/reminders-watchdog.service.js';

@Module({
  controllers: [RemindersController],
  providers: [
    RemindersSchedulerService,
    RemindersOutboxService,
    RemindersWatchdogService,
    RemindersService,
  ],
  exports: [
    RemindersSchedulerService,
    RemindersOutboxService,
    RemindersWatchdogService,
    RemindersService,
  ],
})
export class RemindersModule {}
