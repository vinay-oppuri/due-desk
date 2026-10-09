import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  asc,
  businesses,
  complianceRules,
  desc,
  eq,
  filings,
  obligations,
  user,
} from '@repo/db';
import { DRIZZLE, type DrizzleDB } from '../../drizzle/index.js';

@Injectable()
export class ComplianceCalendarService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

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
  getDocumentChecklistForForm(formCode: string): string[] {
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
