import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  businesses,
  complianceRules,
  count,
  deliveryLog,
  eq,
  gte,
  inArray,
  lte,
  memberships,
  obligations,
  reminders,
  sql,
  user,
} from '@repo/db';
import {
  sendReminderEmail,
  type SendReminderEmailOptions,
} from '@repo/auth/email';
import { DRIZZLE, type DrizzleDB } from '../drizzle/index.js';

export interface ScanResult {
  scanned: number;
  sent: number;
  skippedFiled: number;
  failed: number;
  dead: number;
  deferred: number;
  budgetUsedToday: number;
  budgetRemaining: number;
}

export interface WatchdogResult {
  checkedObligations: number;
  repairedCount: number;
  repairedReminders: Array<{
    obligationId: string;
    channel: string;
    offsetDays: number;
  }>;
}

// Resend free tier limits
const DAILY_EMAIL_BUDGET_LIMIT = 100;
const DAILY_EMAIL_SAFE_CAP = 90;
const DAILY_EMAIL_ALERT_THRESHOLD = 70; // 70% threshold

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Schedules reminders (7, 3, and 1 days before due date) for an obligation.
   * Safe to run multiple times due to unique constraint on (obligationId, channel, offsetDays).
   */
  async scheduleRemindersForObligation(
    obligationId: string,
    organizationId: string,
    dueDate: string,
    channel: string = 'email',
  ): Promise<number> {
    const offsets = [7, 3, 1];
    let createdCount = 0;

    for (const offset of offsets) {
      const [year, month, day] = dueDate.split('-').map(Number);
      // Scheduled send time: 09:00 AM IST (03:30 AM UTC) on (dueDate - offsetDays)
      const sendAt = new Date(Date.UTC(year, month - 1, day - offset, 3, 30, 0));
      const reminderId = `rem_${randomUUID().replace(/-/g, '')}`;

      const res = await this.db
        .insert(reminders)
        .values({
          id: reminderId,
          organizationId,
          obligationId,
          channel,
          offsetDays: offset,
          sendAt,
          state: 'pending',
          attempts: 0,
        })
        .onConflictDoNothing({
          target: [
            reminders.obligationId,
            reminders.channel,
            reminders.offsetDays,
          ],
        });

      if (res.rowCount && res.rowCount > 0) {
        createdCount++;
      }
    }

    return createdCount;
  }

  /**
   * Bulk scheduler for multiple obligations using high-performance batch insertion.
   */
  async scheduleRemindersForObligations(
    items: Array<{ id: string; organizationId: string; dueDate: string }>,
  ): Promise<number> {
    if (!items || items.length === 0) return 0;

    const reminderRows: Array<{
      id: string;
      organizationId: string;
      obligationId: string;
      channel: string;
      offsetDays: number;
      sendAt: Date;
      state: string;
      attempts: number;
    }> = [];
    const offsets = [7, 3, 1];

    for (const item of items) {
      const [year, month, day] = item.dueDate.split('-').map(Number);
      for (const offset of offsets) {
        const sendAt = new Date(Date.UTC(year, month - 1, day - offset, 3, 30, 0));
        reminderRows.push({
          id: `rem_${randomUUID().replace(/-/g, '')}`,
          organizationId: item.organizationId,
          obligationId: item.id,
          channel: 'email',
          offsetDays: offset,
          sendAt,
          state: 'pending',
          attempts: 0,
        });
      }
    }

    if (reminderRows.length === 0) return 0;

    const CHUNK_SIZE = 100;
    let totalScheduled = 0;
    for (let i = 0; i < reminderRows.length; i += CHUNK_SIZE) {
      const chunk = reminderRows.slice(i, i + CHUNK_SIZE);
      await this.db
        .insert(reminders)
        .values(chunk)
        .onConflictDoNothing({
          target: [
            reminders.obligationId,
            reminders.channel,
            reminders.offsetDays,
          ],
        });
      totalScheduled += chunk.length;
    }

    return totalScheduled;
  }

  /**
   * Computes the number of successful emails sent today via deliveryLog.
   */
  async getDailyEmailSendCount(): Promise<number> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const result = await this.db
      .select({ val: count() })
      .from(deliveryLog)
      .where(
        and(
          eq(deliveryLog.result, 'success'),
          gte(deliveryLog.attemptAt, today),
        ),
      );

    return Number(result[0]?.val) || 0;
  }

  /**
   * Outbox scanner function:
   * 1. Uses atomic FOR UPDATE SKIP LOCKED to prevent duplicate concurrent runs.
   * 2. Checks email budget guard (100/day limit, 90 safe cap, 70 alert).
   * 3. Skips and marks done reminders whose obligation is already filed.
   * 4. Dispatches reminder via channel provider (Resend email).
   * 5. Handles retry backoff up to 5 attempts, then marks dead and alerts.
   */
  async scanAndDispatchReminders(options?: {
    batchSize?: number;
    nowOverride?: Date;
  }): Promise<ScanResult> {
    const now = options?.nowOverride || new Date();
    const batchSize = options?.batchSize || 25;

    // 1. Check daily email budget
    const sentToday = await this.getDailyEmailSendCount();
    if (sentToday >= DAILY_EMAIL_ALERT_THRESHOLD) {
      this.logger.warn(
        `[OPERATOR ALERT] Daily email budget usage has reached ${sentToday}/${DAILY_EMAIL_BUDGET_LIMIT} (${Math.round((sentToday / DAILY_EMAIL_BUDGET_LIMIT) * 100)}%).`,
      );
    }

    if (sentToday >= DAILY_EMAIL_SAFE_CAP) {
      this.logger.warn(
        `[BUDGET GUARD] Daily safe email threshold reached (${sentToday}/${DAILY_EMAIL_SAFE_CAP}). Deferring pending reminders.`,
      );
      return {
        scanned: 0,
        sent: 0,
        skippedFiled: 0,
        failed: 0,
        dead: 0,
        deferred: 0,
        budgetUsedToday: sentToday,
        budgetRemaining: 0,
      };
    }

    const remainingBudget = Math.max(0, DAILY_EMAIL_SAFE_CAP - sentToday);
    const effectiveLimit = Math.min(batchSize, remainingBudget);

    // 2. Select and atomically claim reminders using FOR UPDATE SKIP LOCKED
    // By transitioning state from 'pending' to 'sending' in a single atomic statement,
    // concurrent scan instances will skip locked/already-claimed rows.
    const queryResult = await this.db.execute(sql`
      UPDATE reminders
      SET state = 'sending', updated_at = NOW()
      WHERE id IN (
        SELECT r.id
        FROM reminders r
        JOIN obligations o ON r.obligation_id = o.id
        WHERE r.state = 'pending'
          AND r.send_at <= ${now.toISOString()}
        ORDER BY o.due_date ASC, r.send_at ASC
        LIMIT ${effectiveLimit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, organization_id, obligation_id, channel, offset_days, send_at, attempts;
    `);

    const rawRows = Array.isArray(queryResult)
      ? queryResult
      : (queryResult as any).rows || [];

    const claimed = rawRows as Array<{
      id: string;
      organization_id: string;
      obligation_id: string;
      channel: string;
      offset_days: number;
      send_at: string;
      attempts: number;
    }>;

    if (claimed.length === 0) {
      return {
        scanned: 0,
        sent: 0,
        skippedFiled: 0,
        failed: 0,
        dead: 0,
        deferred: 0,
        budgetUsedToday: sentToday,
        budgetRemaining: remainingBudget,
      };
    }

    // Pre-fetch all reminder metadata and recipient emails in 2 batched queries
    const claimedIds = claimed.map((r) => r.id);
    const orgIds = [...new Set(claimed.map((r) => r.organization_id))];

    const detailsRows = await this.db
      .select({
        reminder_id: reminders.id,
        obligation_id: obligations.id,
        obligation_status: obligations.status,
        obligation_due_date: obligations.dueDate,
        business_name: businesses.name,
        form_code: complianceRules.formCode,
        rule_name: complianceRules.name,
        portal_url: complianceRules.sourceUrl,
      })
      .from(reminders)
      .leftJoin(obligations, eq(reminders.obligationId, obligations.id))
      .leftJoin(businesses, eq(obligations.businessId, businesses.id))
      .leftJoin(complianceRules, eq(obligations.ruleId, complianceRules.id))
      .where(inArray(reminders.id, claimedIds));

    const detailsMap = new Map<string, any>();
    for (const row of detailsRows) {
      detailsMap.set(row.reminder_id, row);
    }

    const emailRows = await this.db
      .select({
        organizationId: memberships.organizationId,
        email: user.email,
      })
      .from(memberships)
      .innerJoin(user, eq(memberships.userId, user.id))
      .where(
        and(
          inArray(memberships.organizationId, orgIds),
          inArray(memberships.role, ['owner', 'accountant', 'ca']),
        ),
      );

    const emailMap = new Map<string, string>();
    for (const row of emailRows) {
      if (!emailMap.has(row.organizationId)) {
        emailMap.set(row.organizationId, row.email);
      }
    }

    let sent = 0;
    let skippedFiled = 0;
    let failed = 0;
    let dead = 0;

    for (const reminder of claimed) {
      try {
        const detail = detailsMap.get(reminder.id);

        if (!detail || !detail.obligation_id) {
          await this.markReminderDead(reminder.id, 'Obligation not found');
          dead++;
          continue;
        }

        // 3. Skip and mark done if obligation is already filed
        if (detail.obligation_status === 'filed') {
          await this.db
            .update(reminders)
            .set({
              state: 'sent',
              lastError: 'Skipped: obligation already filed',
              updatedAt: new Date(),
            })
            .where(eq(reminders.id, reminder.id));

          await this.logDelivery({
            reminderId: reminder.id,
            result: 'success',
            providerId: 'skipped_filed',
            error: 'Obligation already filed; reminder skipped',
          });

          skippedFiled++;
          continue;
        }

        const recipientEmail =
          emailMap.get(reminder.organization_id) || 'compliance-alert@duedesk.in';

        // 4. Dispatch email via Resend
        const sendResult = await sendReminderEmail({
          email: recipientEmail,
          businessName: detail.business_name || 'Your Business',
          formCode: detail.form_code || 'STATUTORY',
          ruleName: detail.rule_name || 'Compliance Obligation',
          dueDate: detail.obligation_due_date,
          offsetDays: reminder.offset_days,
          portalUrl: detail.portal_url,
        });

        if (sendResult.success) {
          // Success: update reminder state and log
          await this.db
            .update(reminders)
            .set({
              state: 'sent',
              attempts: reminder.attempts + 1,
              lastError: null,
              updatedAt: new Date(),
            })
            .where(eq(reminders.id, reminder.id));

          await this.logDelivery({
            reminderId: reminder.id,
            result: 'success',
            providerId: sendResult.providerId || null,
          });

          sent++;
        } else {
          // Failure: handle retry and backoff
          const newAttempts = reminder.attempts + 1;
          const errorMsg = sendResult.error || 'Provider dispatch failed';

          await this.logDelivery({
            reminderId: reminder.id,
            result: 'failure',
            error: errorMsg,
          });

          if (newAttempts >= 5) {
            // Reached 5 attempts: mark dead and raise alert
            await this.markReminderDead(reminder.id, errorMsg, newAttempts);
            this.logger.error(
              `[ALERT: DEAD LETTER] Reminder ${reminder.id} exceeded max attempts (5). Error: ${errorMsg}`,
            );
            dead++;
          } else {
            // Retry with exponential backoff: 2^attempts * 15 minutes
            const backoffMinutes = Math.pow(2, newAttempts) * 15;
            const nextSendAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

            await this.db
              .update(reminders)
              .set({
                state: 'failed',
                attempts: newAttempts,
                sendAt: nextSendAt,
                lastError: errorMsg,
                updatedAt: new Date(),
              })
              .where(eq(reminders.id, reminder.id));

            this.logger.warn(
              `[RETRY SCHEDULED] Reminder ${reminder.id} attempt ${newAttempts}/5 failed. Next retry at ${nextSendAt.toISOString()}`,
            );
            failed++;
          }
        }
      } catch (err: any) {
        this.logger.error(
          `Unexpected exception processing reminder ${reminder.id}: ${err.message}`,
        );
        await this.markReminderFailed(reminder.id, err.message, reminder.attempts + 1);
        failed++;
      }
    }

    return {
      scanned: claimed.length,
      sent,
      skippedFiled,
      failed,
      dead,
      deferred: 0,
      budgetUsedToday: sentToday + sent,
      budgetRemaining: Math.max(0, remainingBudget - sent),
    };
  }

  /**
   * Daily Watchdog:
   * Verifies that every pending obligation due in the next 7 days has its reminder records.
   * Repairs missing records and raises an alert if repairs were performed.
   */
  async runWatchdog(options?: {
    daysAhead?: number;
    nowOverride?: Date;
  }): Promise<WatchdogResult> {
    const now = options?.nowOverride || new Date();
    const daysAhead = options?.daysAhead || 7;

    const todayStr = now.toISOString().split('T')[0];
    const targetEnd = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const targetEndStr = targetEnd.toISOString().split('T')[0];

    // Find all pending obligations due between today and today + 7 days
    const upcoming = await this.db
      .select({
        id: obligations.id,
        organizationId: obligations.organizationId,
        dueDate: obligations.dueDate,
        status: obligations.status,
      })
      .from(obligations)
      .where(
        and(
          eq(obligations.status, 'pending'),
          gte(obligations.dueDate, todayStr),
          lte(obligations.dueDate, targetEndStr),
        ),
      );

    const requiredOffsets = [7, 3, 1];
    const repairedReminders: Array<{
      obligationId: string;
      channel: string;
      offsetDays: number;
    }> = [];

    for (const ob of upcoming) {
      // Check existing reminders for this obligation
      const existing = await this.db
        .select({
          offsetDays: reminders.offsetDays,
          channel: reminders.channel,
        })
        .from(reminders)
        .where(eq(reminders.obligationId, ob.id));

      const existingOffsets = new Set(
        existing
          .filter((r) => r.channel === 'email')
          .map((r) => r.offsetDays),
      );

      for (const offset of requiredOffsets) {
        if (!existingOffsets.has(offset)) {
          // Missing reminder! Calculate sendAt
          const [year, month, day] = ob.dueDate.split('-').map(Number);
          let sendAt = new Date(Date.UTC(year, month - 1, day - offset, 3, 30, 0));

          // If calculated sendAt is already in the past, schedule it immediately
          if (sendAt < now) {
            sendAt = now;
          }

          const reminderId = `rem_${randomUUID().replace(/-/g, '')}`;

          await this.db
            .insert(reminders)
            .values({
              id: reminderId,
              organizationId: ob.organizationId,
              obligationId: ob.id,
              channel: 'email',
              offsetDays: offset,
              sendAt,
              state: 'pending',
              attempts: 0,
            })
            .onConflictDoNothing();

          repairedReminders.push({
            obligationId: ob.id,
            channel: 'email',
            offsetDays: offset,
          });
        }
      }
    }

    if (repairedReminders.length > 0) {
      this.logger.warn(
        `[WATCHDOG ALERT] Watchdog identified and repaired ${repairedReminders.length} missing reminder(s).`,
      );
    }

    return {
      checkedObligations: upcoming.length,
      repairedCount: repairedReminders.length,
      repairedReminders,
    };
  }

  /**
   * Retrieves reminders for an organization with delivery audit trail.
   */
  async getReminders(orgId: string, state?: string) {
    let query = this.db
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

  /**
   * Helper to write delivery log entry.
   */
  private async logDelivery(data: {
    reminderId: string;
    result: string;
    providerId?: string | null;
    error?: string;
  }) {
    const logId = `del_${randomUUID().replace(/-/g, '')}`;
    await this.db.insert(deliveryLog).values({
      id: logId,
      reminderId: data.reminderId,
      result: data.result,
      providerId: data.providerId || null,
      error: data.error || null,
    });
  }

  /**
   * Helper to mark a reminder as dead.
   */
  private async markReminderDead(
    reminderId: string,
    error: string,
    attempts: number = 5,
  ) {
    await this.db
      .update(reminders)
      .set({
        state: 'dead',
        attempts,
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(reminders.id, reminderId));
  }

  /**
   * Helper to mark a reminder as failed.
   */
  private async markReminderFailed(
    reminderId: string,
    error: string,
    attempts: number,
  ) {
    await this.db
      .update(reminders)
      .set({
        state: 'failed',
        attempts,
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(reminders.id, reminderId));
  }
}
