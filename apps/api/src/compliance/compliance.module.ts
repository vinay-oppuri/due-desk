import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller.js';
import { ComplianceService } from './compliance.service.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { RemindersModule } from '../reminders/reminders.module.js';

@Module({
  imports: [DrizzleModule, RemindersModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}

