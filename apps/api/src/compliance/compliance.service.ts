import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  businesses,
  complianceRules,
  desc,
  eq,
  filings,
  holidays,
  obligations,
  ruleConditions,
  ruleOverrides,
  sql,
  user,
} from '@repo/db';
import {
  generateObligations as runRulesGenerator,
  type BusinessProfile,
  type ComplianceRule,
  type Holiday,
  type RuleCondition,
  type RuleOverride,
} from '@repo/rules';
import { DRIZZLE, type DrizzleDB } from '../drizzle/index.js';
import { RemindersService } from '../reminders/reminders.service.js';

export interface CreateBusinessDto {
  name: string;
  state: string;
  businessType: string;
  turnoverBracket: string;
  hasEmployees?: boolean;
  gstin?: string;
  panLast4?: string;
  registrations?: {
    gst?: boolean;
    qrmp?: boolean;
    pf?: boolean;
    esi?: boolean;
    pt?: boolean;
    [key: string]: any;
  };
  agmDate?: string;
}

export interface MarkFiledDto {
  filedOn?: string;
  notes?: string;
}

@Injectable()
export class ComplianceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly remindersService: RemindersService,
  ) {}

  /**
   * Creates a business profile and automatically generates its compliance obligations.
   */
  async createBusiness(orgId: string, dto: CreateBusinessDto) {
    const bizId = `biz_${randomUUID().replace(/-/g, '')}`;

    const newBusiness = {
      id: bizId,
      organizationId: orgId,
      name: dto.name,
      state: dto.state.toUpperCase(),
      businessType: dto.businessType || 'pvt_ltd',
      turnoverBracket: dto.turnoverBracket || '<40L',
      hasEmployees: !!dto.hasEmployees,
      gstin: dto.gstin?.toUpperCase() || null,
      panLast4: dto.panLast4?.toUpperCase() || null,
      registrations: dto.registrations || {},
    };

    await this.db.insert(businesses).values(newBusiness);

    // Automatically generate obligations for the business
    const generatedCount = await this.generateObligationsForBusiness(
      bizId,
      orgId,
      dto.agmDate,
    );

    return {
      ...newBusiness,
      obligationsGenerated: generatedCount,
    };
  }

  /**
   * Generates obligations using the pure @repo/rules engine and saves them to Neon Postgres.
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

    const CHUNK_SIZE = 50;
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

  /**
   * Retrieves obligations for an organization with optional filtering.
   */
  async getObligations(
    orgId: string,
    filters: {
      businessId?: string;
      month?: string; // YYYY-MM
      upcomingDays?: number;
      status?: string;
    } = {},
  ) {
    const today = new Date().toISOString().slice(0, 10);

    const conditions = [eq(obligations.organizationId, orgId)];

    if (filters.businessId) {
      conditions.push(eq(obligations.businessId, filters.businessId));
    }
    if (filters.status) {
      conditions.push(eq(obligations.status, filters.status));
    }

    const rows = await this.db
      .select({
        id: obligations.id,
        businessId: obligations.businessId,
        businessName: businesses.name,
        businessState: businesses.state,
        ruleId: obligations.ruleId,
        ruleVersion: obligations.ruleVersion,
        formCode: complianceRules.formCode,
        formName: complianceRules.name,
        frequency: complianceRules.frequency,
        sourceUrl: complianceRules.sourceUrl,
        periodLabel: obligations.periodLabel,
        dueDate: obligations.dueDate,
        status: obligations.status,
      })
      .from(obligations)
      .innerJoin(businesses, eq(obligations.businessId, businesses.id))
      .innerJoin(complianceRules, eq(obligations.ruleId, complianceRules.id))
      .where(and(...conditions))
      .orderBy(asc(obligations.dueDate));

    // Map through rows to dynamically detect late status and calculate remaining days
    return rows
      .map((row) => {
        let currentStatus = row.status;
        if (currentStatus === 'pending' && row.dueDate < today) {
          currentStatus = 'late';
        }

        const dueMs = new Date(row.dueDate).getTime();
        const nowMs = new Date(today).getTime();
        const diffDays = Math.round((dueMs - nowMs) / (1000 * 60 * 60 * 24));

        return {
          ...row,
          status: currentStatus,
          daysRemaining: diffDays,
          isDueSoon:
            currentStatus === 'pending' && diffDays >= 0 && diffDays <= 7,
          isLate: currentStatus === 'late',
        };
      })
      .filter((row) => {
        if (filters.month) {
          return row.dueDate.startsWith(filters.month);
        }
        if (filters.upcomingDays != null) {
          return (
            row.daysRemaining >= 0 && row.daysRemaining <= filters.upcomingDays
          );
        }
        return true;
      });
  }

  /**
   * Retrieves single obligation details with required checklist and filing history.
   */
  async getObligationDetail(orgId: string, obligationId: string) {
    const today = new Date().toISOString().slice(0, 10);

    const [row] = await this.db
      .select({
        id: obligations.id,
        businessId: obligations.businessId,
        businessName: businesses.name,
        businessState: businesses.state,
        businessType: businesses.businessType,
        ruleId: obligations.ruleId,
        ruleVersion: obligations.ruleVersion,
        formCode: complianceRules.formCode,
        formName: complianceRules.name,
        frequency: complianceRules.frequency,
        sourceUrl: complianceRules.sourceUrl,
        periodLabel: obligations.periodLabel,
        dueDate: obligations.dueDate,
        status: obligations.status,
      })
      .from(obligations)
      .innerJoin(businesses, eq(obligations.businessId, businesses.id))
      .innerJoin(complianceRules, eq(obligations.ruleId, complianceRules.id))
      .where(
        and(
          eq(obligations.id, obligationId),
          eq(obligations.organizationId, orgId),
        ),
      );

    if (!row) {
      throw new NotFoundException(`Obligation ${obligationId} not found`);
    }

    // Load filing history
    const history = await this.db
      .select({
        id: filings.id,
        filedOn: filings.filedOn,
        notes: filings.notes,
        filedByName: user.name,
        filedByEmail: user.email,
      })
      .from(filings)
      .leftJoin(user, eq(filings.filedBy, user.id))
      .where(eq(filings.obligationId, obligationId))
      .orderBy(desc(filings.filedOn));

    let currentStatus = row.status;
    if (currentStatus === 'pending' && row.dueDate < today) {
      currentStatus = 'late';
    }

    const dueMs = new Date(row.dueDate).getTime();
    const nowMs = new Date(today).getTime();
    const diffDays = Math.round((dueMs - nowMs) / (1000 * 60 * 60 * 24));

    // Document checklist based on statutory form code
    const documentChecklist = this.getDocumentChecklistForForm(row.formCode);

    return {
      ...row,
      status: currentStatus,
      daysRemaining: diffDays,
      isDueSoon: currentStatus === 'pending' && diffDays >= 0 && diffDays <= 7,
      isLate: currentStatus === 'late',
      documentChecklist,
      filingHistory: history,
      disclaimer:
        'Reminder tool, not tax advice. Verify dates with the official portal or your CA.',
    };
  }

  /**
   * Marks an obligation as filed and records the filing event in the append-only history.
   */
  async markAsFiled(
    orgId: string,
    userId: string,
    obligationId: string,
    dto: MarkFiledDto = {},
  ) {
    const [ob] = await this.db
      .select()
      .from(obligations)
      .where(
        and(
          eq(obligations.id, obligationId),
          eq(obligations.organizationId, orgId),
        ),
      );

    if (!ob) {
      throw new NotFoundException(`Obligation ${obligationId} not found`);
    }

    const filedOnDate = dto.filedOn ? new Date(dto.filedOn) : new Date();

    // 1. Update obligation status
    await this.db
      .update(obligations)
      .set({
        status: 'filed',
        updatedAt: new Date(),
      })
      .where(eq(obligations.id, obligationId));

    // 2. Append to filings log
    const filingId = `fil_${randomUUID().replace(/-/g, '')}`;
    await this.db.insert(filings).values({
      id: filingId,
      organizationId: orgId,
      obligationId,
      filedOn: filedOnDate,
      filedBy: userId,
      notes: dto.notes || 'Marked as filed via DueDesk dashboard',
    });

    return {
      id: obligationId,
      status: 'filed',
      filingId,
      filedOn: filedOnDate.toISOString(),
    };
  }

  /**
   * Generates standard iCalendar (.ics) feed string for syncing with Google / Apple / Outlook calendar.
   */
  async generateIcsFeed(orgId: string, businessId?: string): Promise<string> {
    const items = await this.getObligations(orgId, { businessId });

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//DueDesk//Compliance Tracker//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:DueDesk Compliance Calendar',
      'X-WR-TIMEZONE:Asia/Kolkata',
    ];

    for (const item of items) {
      const dateCompact = item.dueDate.replace(/-/g, '');
      const nextDay = new Date(item.dueDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayCompact = nextDay
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${item.id}@duedesk.app`);
      lines.push(
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      );
      lines.push(`DTSTART;VALUE=DATE:${dateCompact}`);
      lines.push(`DTEND;VALUE=DATE:${nextDayCompact}`);
      lines.push(`SUMMARY:${item.formCode} Due - ${item.businessName}`);
      lines.push(
        `DESCRIPTION:${item.formName} (${item.periodLabel}) due on ${item.dueDate}. Status: ${item.status.toUpperCase()}. Official portal: ${item.sourceUrl}\\n\\nReminder tool, not tax advice.`,
      );
      lines.push(
        `STATUS:${item.status === 'filed' ? 'CANCELLED' : 'CONFIRMED'}`,
      );
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /**
   * Helper: standard document checklist for common statutory compliance forms.
   */
  private getDocumentChecklistForForm(formCode: string): string[] {
    const code = formCode.toUpperCase();
    if (code.startsWith('GSTR-1')) {
      return [
        'Outward sales invoices (B2B & B2C)',
        'Credit / debit notes',
        'HSN-wise summary of outward supplies',
      ];
    }
    if (code.startsWith('GSTR-3B')) {
      return [
        'Monthly sales register',
        'Purchase register (GSTR-2B match)',
        'Tax payment challan (PMT-06)',
      ];
    }
    if (code.startsWith('GSTR-9')) {
      return [
        'Audited financial statements',
        'Monthly GSTR-1 & GSTR-3B reconciliations',
        'ITC reconciliation',
      ];
    }
    if (code.includes('24Q')) {
      return [
        'Employee monthly salary sheets',
        'Form 16 declarations',
        'Monthly ITNS-281 tax challans',
      ];
    }
    if (code.includes('26Q') || code.includes('281')) {
      return [
        'Vendor payments & TDS deductee register',
        'TDS challan payment BSR codes',
        'PAN verification records',
      ];
    }
    if (code.startsWith('EPF')) {
      return [
        'Wage register / attendance sheet',
        'ECR text file for EPFO portal',
        'TRRN payment receipt',
      ];
    }
    if (code.startsWith('ESIC')) {
      return [
        'Monthly employee attendance & contribution register',
        'Online ESIC challan payment receipt',
      ];
    }
    if (code.includes('PT-')) {
      return [
        'Salary sheets with PT deduction breakdown',
        'Previous month PT payment receipt',
      ];
    }
    if (code.startsWith('ADVANCE-TAX')) {
      return [
        'Estimated profit & loss statement',
        'Computation of estimated tax liability',
        'Challan 280 payment receipt',
      ];
    }
    if (code.startsWith('AOC-4')) {
      return [
        'Signed balance sheet & P&L account',
        "Directors' Report with MGT-9 extract",
        "Auditor's Report",
      ];
    }
    if (code.startsWith('MGT-7')) {
      return [
        'Shareholding pattern details',
        'List of board and committee meetings',
        'Annual general meeting minutes',
      ];
    }
    return [
      'Relevant tax registers and payment proofs',
      'Official portal acknowledgement',
    ];
  }
}
