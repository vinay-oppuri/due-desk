import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import {
  reminders,
  deliveryLog,
  complianceRules,
  ruleAuditLog,
  filings,
  documents,
  obligations,
  businesses,
  eq,
  desc,
  gte,
  sql,
  sum,
} from '@repo/db';
import { DRIZZLE, type DrizzleDB } from '../drizzle/index.js';

export interface UsageMetrics {
  resend: {
    usedToday: number;
    dailyCap: number;
    percentUsed: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  database: {
    usedBytes: number;
    formattedUsed: string;
    freeTierBytes: number;
    formattedLimit: string;
    percentUsed: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  storage: {
    usedBytes: number;
    formattedUsed: string;
    freeTierBytes: number;
    formattedLimit: string;
    percentUsed: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  systemAlerts: string[];
  checkedAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(@Inject(DRIZZLE) private readonly drizzle: DrizzleDB) {}

  async getUsageMetrics(): Promise<UsageMetrics> {
    const systemAlerts: string[] = [];

    // 1. Resend sends today (UTC)
    const now = new Date();
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

    const deliveryRows = await this.drizzle
      .select({ id: deliveryLog.id })
      .from(deliveryLog)
      .where(gte(deliveryLog.attemptAt, startOfTodayUtc));

    const emailsSentToday = deliveryRows.length;
    const resendDailyCap = 90; // Safe cap under 100/day free quota
    const resendPercent = Math.min(100, Math.round((emailsSentToday / resendDailyCap) * 100));
    const resendStatus: 'healthy' | 'warning' | 'critical' =
      resendPercent >= 90 ? 'critical' : resendPercent >= 70 ? 'warning' : 'healthy';

    if (resendStatus === 'critical') {
      systemAlerts.push(`Resend email delivery is near cap: ${emailsSentToday}/${resendDailyCap} (${resendPercent}%)`);
    } else if (resendStatus === 'warning') {
      systemAlerts.push(`Resend email usage passed 70% threshold: ${emailsSentToday}/${resendDailyCap} (${resendPercent}%)`);
    }

    // 2. Database size in bytes
    let dbSizeBytes = 0;
    try {
      const dbSizeResult = await this.drizzle.execute(
        sql`SELECT pg_database_size(current_database()) AS size_bytes;`
      );
      dbSizeBytes = Number(dbSizeResult.rows[0]?.size_bytes ?? 0);
    } catch (err) {
      this.logger.warn(`Could not fetch pg_database_size: ${err instanceof Error ? err.message : String(err)}`);
    }

    const dbFreeTierBytes = 500 * 1024 * 1024; // 500 MB free tier
    const dbPercent = Math.min(100, Math.round((dbSizeBytes / dbFreeTierBytes) * 100));
    const dbStatus: 'healthy' | 'warning' | 'critical' =
      dbPercent >= 90 ? 'critical' : dbPercent >= 70 ? 'warning' : 'healthy';

    if (dbStatus === 'critical') {
      systemAlerts.push(`Neon DB storage is near 500MB free limit: ${formatBytes(dbSizeBytes)} (${dbPercent}%)`);
    } else if (dbStatus === 'warning') {
      systemAlerts.push(`Neon DB storage exceeded 70% threshold: ${formatBytes(dbSizeBytes)} (${dbPercent}%)`);
    }

    // 3. R2 documents storage size
    let storageBytes = 0;
    try {
      const storageResult = await this.drizzle
        .select({ total: sum(documents.fileSize) })
        .from(documents);
      storageBytes = Number(storageResult[0]?.total ?? 0);
    } catch (err) {
      this.logger.warn(`Could not compute documents storage sum: ${err instanceof Error ? err.message : String(err)}`);
    }

    const r2FreeTierBytes = 10 * 1024 * 1024 * 1024; // 10 GB free tier
    const r2Percent = Math.min(100, Math.round((storageBytes / r2FreeTierBytes) * 100));
    const r2Status: 'healthy' | 'warning' | 'critical' =
      r2Percent >= 90 ? 'critical' : r2Percent >= 70 ? 'warning' : 'healthy';

    if (r2Status === 'critical') {
      systemAlerts.push(`R2 cloud storage is near 10GB free limit: ${formatBytes(storageBytes)} (${r2Percent}%)`);
    } else if (r2Status === 'warning') {
      systemAlerts.push(`R2 cloud storage exceeded 70% threshold: ${formatBytes(storageBytes)} (${r2Percent}%)`);
    }

    return {
      resend: {
        usedToday: emailsSentToday,
        dailyCap: resendDailyCap,
        percentUsed: resendPercent,
        status: resendStatus,
      },
      database: {
        usedBytes: dbSizeBytes,
        formattedUsed: formatBytes(dbSizeBytes),
        freeTierBytes: dbFreeTierBytes,
        formattedLimit: formatBytes(dbFreeTierBytes),
        percentUsed: dbPercent,
        status: dbStatus,
      },
      storage: {
        usedBytes: storageBytes,
        formattedUsed: formatBytes(storageBytes),
        freeTierBytes: r2FreeTierBytes,
        formattedLimit: formatBytes(r2FreeTierBytes),
        percentUsed: r2Percent,
        status: r2Status,
      },
      systemAlerts,
      checkedAt: new Date().toISOString(),
    };
  }

  async runDailyUsageCheck(): Promise<{ alertCount: number; alerts: string[]; metrics: UsageMetrics }> {
    const metrics = await this.getUsageMetrics();
    if (metrics.systemAlerts.length > 0) {
      for (const alert of metrics.systemAlerts) {
        this.logger.warn(`[OPERATOR ALERT: USAGE THRESHOLD EXCEEDED] ${alert}`);
      }
    } else {
      this.logger.log(`[Usage Monitor] All free tier quotas within safe limits (under 70%).`);
    }
    return {
      alertCount: metrics.systemAlerts.length,
      alerts: metrics.systemAlerts,
      metrics,
    };
  }

  async getDeadReminders() {
    return await this.drizzle
      .select({
        id: reminders.id,
        organizationId: reminders.organizationId,
        obligationId: reminders.obligationId,
        channel: reminders.channel,
        offsetDays: reminders.offsetDays,
        sendAt: reminders.sendAt,
        state: reminders.state,
        attempts: reminders.attempts,
        lastError: reminders.lastError,
        updatedAt: reminders.updatedAt,
        businessName: businesses.name,
        dueDate: obligations.dueDate,
        periodLabel: obligations.periodLabel,
      })
      .from(reminders)
      .innerJoin(obligations, eq(reminders.obligationId, obligations.id))
      .innerJoin(businesses, eq(obligations.businessId, businesses.id))
      .where(eq(reminders.state, 'dead'))
      .orderBy(desc(reminders.updatedAt));
  }

  async retryDeadReminder(id: string) {
    const existing = await this.drizzle
      .select()
      .from(reminders)
      .where(eq(reminders.id, id))
      .limit(1);

    if (!existing.length) {
      throw new NotFoundException(`Reminder ${id} not found.`);
    }

    await this.drizzle
      .update(reminders)
      .set({
        state: 'pending',
        attempts: 0,
        lastError: null,
        sendAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reminders.id, id));

    this.logger.log(`Dead reminder ${id} requeued to pending state.`);
    return { success: true, message: `Reminder ${id} requeued as pending.` };
  }

  async getFailedDeliveries(limit = 20) {
    return await this.drizzle
      .select({
        id: deliveryLog.id,
        reminderId: deliveryLog.reminderId,
        attemptAt: deliveryLog.attemptAt,
        result: deliveryLog.result,
        providerId: deliveryLog.providerId,
        error: deliveryLog.error,
      })
      .from(deliveryLog)
      .where(eq(deliveryLog.result, 'failure'))
      .orderBy(desc(deliveryLog.attemptAt))
      .limit(limit);
  }

  async getUnverifiedRules() {
    return await this.drizzle
      .select({
        id: complianceRules.id,
        formCode: complianceRules.formCode,
        name: complianceRules.name,
        frequency: complianceRules.frequency,
        sourceUrl: complianceRules.sourceUrl,
        version: complianceRules.version,
        verified: complianceRules.verified,
        effectiveFrom: complianceRules.effectiveFrom,
        effectiveTo: complianceRules.effectiveTo,
      })
      .from(complianceRules)
      .where(eq(complianceRules.verified, false))
      .orderBy(complianceRules.formCode);
  }

  async getAuditTrail(limit = 50) {
    const ruleAudits = await this.drizzle
      .select({
        id: ruleAuditLog.id,
        ruleId: ruleAuditLog.ruleId,
        changedBy: ruleAuditLog.changedBy,
        change: ruleAuditLog.change,
        reason: ruleAuditLog.reason,
        at: ruleAuditLog.at,
      })
      .from(ruleAuditLog)
      .orderBy(desc(ruleAuditLog.at))
      .limit(limit);

    const filingAudits = await this.drizzle
      .select({
        id: filings.id,
        organizationId: filings.organizationId,
        obligationId: filings.obligationId,
        filedOn: filings.filedOn,
        filedBy: filings.filedBy,
        notes: filings.notes,
      })
      .from(filings)
      .orderBy(desc(filings.filedOn))
      .limit(limit);

    return { ruleAudits, filingAudits };
  }
}
