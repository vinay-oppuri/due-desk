import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and,
  eq,
  gte,
  lte,
  obligations,
  reminders,
} from '@repo/db';
import { DRIZZLE, type DrizzleDB } from '../../drizzle/index.js';

export interface WatchdogResult {
  checkedObligations: number;
  repairedCount: number;
  repairedReminders: Array<{
    obligationId: string;
    channel: string;
    offsetDays: number;
  }>;
}

@Injectable()
export class RemindersWatchdogService {
  private readonly logger = new Logger(RemindersWatchdogService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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

    const todayStr = now.toISOString().split('T')[0]!;
    const targetEnd = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const targetEndStr = targetEnd.toISOString().split('T')[0]!;

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
          let sendAt = new Date(Date.UTC(year!, month! - 1, day! - offset, 3, 30, 0));

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
}
