import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and,
  businesses,
  complianceRules,
  eq,
  holidays,
  obligations,
  ruleConditions,
  ruleOverrides,
} from '@repo/db';
import {
  generateObligations as runRulesGenerator,
  type BusinessProfile,
  type ComplianceRule,
  type Holiday,
  type RuleCondition,
  type RuleOverride,
} from '@repo/rules';
import { DRIZZLE, type DrizzleDB } from '../../drizzle/index.js';
import { RemindersService } from '../../reminders/reminders.service.js';

@Injectable()
export class ComplianceGeneratorService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly remindersService: RemindersService,
  ) {}

  /**
   * Generates obligations using the pure @repo/rules engine and saves them to Neon Postgres.
   * Then schedules reminder offsets (7, 3, 1 days).
   */
  async generateObligationsForBusiness(
    businessId: string,
    orgId: string,
    agmDate?: string,
  ): Promise<number> {
    const [bizRow] = await this.db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, businessId),
          eq(businesses.organizationId, orgId),
        ),
      );

    if (!bizRow) {
      throw new NotFoundException(`Business ${businessId} not found`);
    }

    // Load active rules, conditions, holidays, overrides from database
    const dbRules = await this.db.select().from(complianceRules);
    const dbConditions = await this.db.select().from(ruleConditions);
    const dbHolidays = await this.db.select().from(holidays);
    const dbOverrides = await this.db.select().from(ruleOverrides);

    const profile: BusinessProfile = {
      id: bizRow.id,
      name: bizRow.name,
      state: bizRow.state,
      businessType: bizRow.businessType,
      turnoverBracket: bizRow.turnoverBracket,
      hasEmployees: bizRow.hasEmployees,
      gstin: bizRow.gstin,
      panLast4: bizRow.panLast4,
      registrations: bizRow.registrations as any,
    };

    const rules: ComplianceRule[] = dbRules.map((r) => ({
      id: r.id,
      formCode: r.formCode,
      name: r.name,
      frequency: r.frequency as any,
      dueFormula: r.dueFormula as any,
      shiftOnHoliday: r.shiftOnHoliday as any,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      version: r.version,
      sourceUrl: r.sourceUrl,
      verified: r.verified,
    }));

    const conditions: RuleCondition[] = dbConditions.map((c) => ({
      ruleId: c.ruleId,
      field: c.field,
      operator: c.operator as any,
      value: c.value,
    }));

    const holidayList: Holiday[] = dbHolidays.map((h) => ({
      state: h.state,
      date: h.date,
      name: h.name,
    }));

    const overrideList: RuleOverride[] = dbOverrides.map((o) => ({
      ruleId: o.ruleId,
      periodLabel: o.periodLabel,
      newDueDate: o.newDueDate,
      sourceUrl: o.sourceUrl,
      appliesTo: o.appliesTo as any,
    }));

    // Generate obligations across financial year 2026-27 (Apr 2026 - Mar 2027)
    const generated = runRulesGenerator({
      profile,
      rules,
      conditions,
      holidays: holidayList,
      overrides: overrideList,
      range: {
        startDate: '2026-04-01',
        endDate: '2027-03-31',
      },
      eventContext: {
        agmDate: agmDate || '2026-09-30',
      },
    });

    if (!generated || generated.length === 0) {
      return 0;
    }

    const obligationRows = generated.map((ob) => ({
      id: `ob_${randomUUID().replace(/-/g, '')}`,
      organizationId: orgId,
      businessId: ob.businessId,
      ruleId: ob.ruleId,
      ruleVersion: ob.ruleVersion,
      periodLabel: ob.periodLabel,
      dueDate: ob.dueDate,
      status: 'pending' as const,
    }));

    const CHUNK_SIZE = 500;
    const insertedObligations: Array<{
      id: string;
      organizationId: string;
      dueDate: string;
    }> = [];

    for (let i = 0; i < obligationRows.length; i += CHUNK_SIZE) {
      const chunk = obligationRows.slice(i, i + CHUNK_SIZE);
      const inserted = await this.db
        .insert(obligations)
        .values(chunk)
        .onConflictDoNothing({
          target: [
            obligations.businessId,
            obligations.ruleId,
            obligations.periodLabel,
          ],
        })
        .returning({
          id: obligations.id,
          organizationId: obligations.organizationId,
          dueDate: obligations.dueDate,
        });

      if (inserted && inserted.length > 0) {
        insertedObligations.push(...inserted);
      }
    }

    // High-performance batch schedule reminders (7, 3, 1 days before due date)
    if (insertedObligations.length > 0) {
      await this.remindersService.scheduleRemindersForObligations(
        insertedObligations,
      );
    }

    return insertedObligations.length;
  }
}
