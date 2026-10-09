import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  businesses,
  complianceRules,
  eq,
  obligations,
  reminders,
} from '@repo/db';
import { DRIZZLE, type DrizzleDB } from '../drizzle/index.js';
import { RemindersSchedulerService } from './services/reminders-scheduler.service.js';
import {
  RemindersOutboxService,
  type ScanResult,
} from './services/reminders-outbox.service.js';
import {
  RemindersWatchdogService,
  type WatchdogResult,
} from './services/reminders-watchdog.service.js';

export type { ScanResult, WatchdogResult };

@Injectable()
export class RemindersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly scheduler: RemindersSchedulerService,
    private readonly outbox: RemindersOutboxService,
    private readonly watchdog: RemindersWatchdogService,
  ) {}

  /**
   * Schedules reminders (7, 3, and 1 days before due date) for an obligation.
   */
  async scheduleRemindersForObligation(
    obligationId: string,
    organizationId: string,
    dueDate: string,
    channel: string = 'email',
  ): Promise<number> {
    return this.scheduler.scheduleRemindersForObligation(
      obligationId,
      organizationId,
      dueDate,
      channel,
    );
  }

  /**
   * Bulk scheduler for multiple obligations using high-performance batch insertion.
   */
  async scheduleRemindersForObligations(
    items: Array<{ id: string; organizationId: string; dueDate: string }>,
  ): Promise<number> {
    return this.scheduler.scheduleRemindersForObligations(items);
  }

  /**
   * Computes the number of successful emails sent today via deliveryLog.
   */
  async getDailyEmailSendCount(): Promise<number> {
    return this.outbox.getDailyEmailSendCount();
  }

  /**
   * Outbox scanner function: scans, claims, and dispatches due reminders.
   */
  async scanAndDispatchReminders(options?: {
    batchSize?: number;
    nowOverride?: Date;
  }): Promise<ScanResult> {
    return this.outbox.scanAndDispatchReminders(options);
  }

  /**
   * Daily Watchdog: repairs missing reminders for upcoming obligations.
   */
  async runWatchdog(options?: {
    daysAhead?: number;
    nowOverride?: Date;
  }): Promise<WatchdogResult> {
    return this.watchdog.runWatchdog(options);
  }

  /**
   * Retrieves reminders for an organization with delivery audit trail.
   */
  async getReminders(orgId: string, state?: string) {
    const query = this.db
      .select({
        id: reminders.id,
        obligationId: reminders.obligationId,
        channel: reminders.channel,
        offsetDays: reminders.offsetDays,
        sendAt: reminders.sendAt,
        state: reminders.state,
        attempts: reminders.attempts,
        lastError: reminders.lastError,
        dueDate: obligations.dueDate,
        periodLabel: obligations.periodLabel,
        obligationStatus: obligations.status,
        businessName: businesses.name,
        formCode: complianceRules.formCode,
        ruleName: complianceRules.name,
      })
      .from(reminders)
      .innerJoin(obligations, eq(reminders.obligationId, obligations.id))
      .innerJoin(businesses, eq(obligations.businessId, businesses.id))
      .innerJoin(complianceRules, eq(obligations.ruleId, complianceRules.id))
      .where(
        state
          ? and(
              eq(reminders.organizationId, orgId),
              eq(reminders.state, state),
            )
          : eq(reminders.organizationId, orgId),
      )
      .orderBy(asc(reminders.sendAt));

    return await query;
  }
}
