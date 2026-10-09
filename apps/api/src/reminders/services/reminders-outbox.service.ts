import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and,
  businesses,
  complianceRules,
  count,
  deliveryLog,
  eq,
  gte,
  inArray,
  memberships,
  obligations,
  reminders,
  sql,
  user,
} from '@repo/db';
import { sendReminderEmail } from '@repo/auth/email';
import { DRIZZLE, type DrizzleDB } from '../../drizzle/index.js';

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

// Resend free tier limits
export const DAILY_EMAIL_BUDGET_LIMIT = 100;
export const DAILY_EMAIL_SAFE_CAP = 90;
export const DAILY_EMAIL_ALERT_THRESHOLD = 70; // 70% threshold

@Injectable()
export class RemindersOutboxService {
  private readonly logger = new Logger(RemindersOutboxService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
          const newAttempts = reminder.attempts + 1;
          const errorMsg = sendResult.error || 'Provider dispatch failed';

          await this.logDelivery({
            reminderId: reminder.id,
            result: 'failure',
            error: errorMsg,
          });

          if (newAttempts >= 5) {
            await this.markReminderDead(reminder.id, errorMsg, newAttempts);
            this.logger.error(
              `[ALERT: DEAD LETTER] Reminder ${reminder.id} exceeded max attempts (5). Error: ${errorMsg}`,
            );
            dead++;
          } else {
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
