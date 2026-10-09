import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { reminders } from '@repo/db';
import { DRIZZLE, type DrizzleDB } from '../../drizzle/index.js';

@Injectable()
export class RemindersSchedulerService {
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
      const sendAt = new Date(Date.UTC(year!, month! - 1, day! - offset, 3, 30, 0));
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
        const sendAt = new Date(Date.UTC(year!, month! - 1, day! - offset, 3, 30, 0));
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

    const CHUNK_SIZE = 500;
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
}
