import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller.js';
import { ComplianceService } from './compliance.service.js';
import { ComplianceGeneratorService } from './services/compliance-generator.service.js';
import { ComplianceCalendarService } from './services/compliance-calendar.service.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { RemindersModule } from '../reminders/reminders.module.js';
import { BillingModule } from '../billing/billing.module.js';

@Module({
  imports: [DrizzleModule, RemindersModule, BillingModule],
  controllers: [ComplianceController],
  providers: [
    ComplianceGeneratorService,
    ComplianceCalendarService,
    ComplianceService,
  ],
  exports: [
    ComplianceGeneratorService,
    ComplianceCalendarService,
    ComplianceService,
  ],
})
export class ComplianceModule {}
