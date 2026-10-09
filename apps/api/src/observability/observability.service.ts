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
} from '@repo/db';
import { DRIZZLE, type DrizzleDB } from '../drizzle/index.js';
import {
  ObservabilityMetricsService,
  formatBytes,
  type UsageMetrics,
} from './services/observability-metrics.service.js';

export { formatBytes, type UsageMetrics };

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(
    @Inject(DRIZZLE) private readonly drizzle: DrizzleDB,
    private readonly metricsService: ObservabilityMetricsService,
  ) {}

  async getUsageMetrics(): Promise<UsageMetrics> {
    return this.metricsService.getUsageMetrics();
  }

  async runDailyUsageCheck(): Promise<{ alertCount: number; alerts: string[]; metrics: UsageMetrics }> {
    return this.metricsService.runDailyUsageCheck();
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
        createdAt: filings.createdAt,
      })
      .from(filings)
      .orderBy(desc(filings.filedOn))
      .limit(limit);

    return {
      ruleAudits,
      filingAudits,
      fetchedAt: new Date().toISOString(),
    };
  }
}
