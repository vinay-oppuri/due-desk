import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and,
  businesses,
  count,
  eq,
} from '@repo/db';
import { DRIZZLE, type DrizzleDB } from '../../drizzle/index.js';
import { BillingService } from '../../billing/billing.service.js';
import { ComplianceGeneratorService } from '../../compliance/services/compliance-generator.service.js';

export interface CsvClientRow {
  name: string;
  state: string;
  businessType?: string;
  turnoverBracket?: string;
  hasEmployees?: boolean | string;
  gstin?: string;
  panLast4?: string;
  registrations?: string | Record<string, boolean>;
  agmDate?: string;
}

export interface ImportError {
  row: number;
  name: string;
  field: string;
  reason: string;
}

export interface ValidatedClient {
  row: number;
  name: string;
  state: string;
  businessType: string;
  turnoverBracket: string;
  hasEmployees: boolean;
  gstin: string | null;
  panLast4: string | null;
  registrations: Record<string, boolean>;
  agmDate: string;
}

export interface ImportPreviewResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: ImportError[];
  preview: ValidatedClient[];
  planLimitInfo: {
    currentBusinesses: number;
    maxBusinesses: number;
    canImportAll: boolean;
    allowedToImport: number;
  };
}

const VALID_INDIAN_STATES = new Set([
  'AP', 'AR', 'AS', 'BR', 'CG', 'GA', 'GJ', 'HR', 'HP', 'JH',
  'KA', 'KL', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PB',
  'RJ', 'SK', 'TN', 'TS', 'TR', 'UP', 'UK', 'WB', 'DL', 'JK',
  'LA', 'CH', 'DN', 'DD', 'LD', 'PY',
]);

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

@Injectable()
export class CaImportService {
  private readonly logger = new Logger(CaImportService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly billingService: BillingService,
    private readonly generator: ComplianceGeneratorService,
  ) {}

  /**
   * Parses raw CSV string or structured array into parsed row objects.
   */
  parseCsv(content: string): CsvClientRow[] {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV file must have at least a header row and one data row.');
    }

    const headers = lines[0]!.split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
    const rows: CsvClientRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      // Handle comma separation with potential quoted strings
      const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
      const rowObj: any = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] || '';
      });
      rows.push(rowObj);
    }

    return rows;
  }

  /**
   * Validates client rows in dry-run mode and checks against subscription limits.
   */
  async previewCsvImport(
    orgId: string,
    rows: CsvClientRow[] | string,
  ): Promise<ImportPreviewResult> {
    const parsedRows = typeof rows === 'string' ? this.parseCsv(rows) : rows;

    if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
      throw new BadRequestException('No client records provided for import.');
    }

    // 1. Check current organization plan limits
    const sub = await this.billingService.getSubscription(orgId);
    const currentBusinesses = sub.usage.businessesCount;
    const maxBusinesses = sub.planConfig.maxBusinesses;
    const remainingSlots = Math.max(0, maxBusinesses - currentBusinesses);

    const errors: ImportError[] = [];
    const preview: ValidatedClient[] = [];

    parsedRows.forEach((row, index) => {
      const rowNum = index + 1;
      const name = (row.name || '').trim();

      if (!name) {
        errors.push({
          row: rowNum,
          name: 'Unknown',
          field: 'name',
          reason: 'Company name is required',
        });
        return;
      }

      const stateRaw = (row.state || '').trim().toUpperCase();
      if (!stateRaw || !VALID_INDIAN_STATES.has(stateRaw)) {
        errors.push({
          row: rowNum,
          name,
          field: 'state',
          reason: `Invalid or missing 2-letter state code (${stateRaw || 'blank'}). Valid examples: KA, MH, DL, TN.`,
        });
        return;
      }

      const gstinRaw = (row.gstin || '').trim().toUpperCase();
      if (gstinRaw && !GSTIN_REGEX.test(gstinRaw)) {
        errors.push({
          row: rowNum,
          name,
          field: 'gstin',
          reason: `Invalid GSTIN format (${gstinRaw}). Must be 15 alphanumeric characters.`,
        });
        return;
      }

      // Parse registrations
      const regObj: Record<string, boolean> = {
        gst: !!gstinRaw,
        pf: false,
        esi: false,
        pt: true, // Default statutory professional tax enabled
      };

      if (typeof row.registrations === 'string') {
        const parts = row.registrations.toLowerCase().split(/[\s,;|]+/);
        if (parts.includes('gst')) regObj.gst = true;
        if (parts.includes('pf')) regObj.pf = true;
        if (parts.includes('esi')) regObj.esi = true;
        if (parts.includes('pt')) regObj.pt = true;
      } else if (typeof row.registrations === 'object' && row.registrations !== null) {
        Object.assign(regObj, row.registrations);
      }

      // Parse boolean hasEmployees
      const hasEmployees =
        row.hasEmployees === true ||
        row.hasEmployees === 'true' ||
        row.hasEmployees === '1' ||
        row.hasEmployees === 'yes' ||
        regObj.pf ||
        regObj.esi;

      preview.push({
        row: rowNum,
        name,
        state: stateRaw,
        businessType: row.businessType || 'pvt_ltd',
        turnoverBracket: row.turnoverBracket || '<40L',
        hasEmployees: !!hasEmployees,
        gstin: gstinRaw || null,
        panLast4: row.panLast4 ? row.panLast4.trim().toUpperCase().slice(0, 4) : null,
        registrations: regObj,
        agmDate: row.agmDate || '2026-09-30',
      });
    });

    const canImportAll = preview.length <= remainingSlots;
    const allowedToImport = Math.min(preview.length, remainingSlots);

    return {
      totalRows: parsedRows.length,
      validCount: preview.length,
      errorCount: errors.length,
      errors,
      preview,
      planLimitInfo: {
        currentBusinesses,
        maxBusinesses,
        canImportAll,
        allowedToImport,
      },
    };
  }

  /**
   * Confirms and bulk-inserts validated clients, and generates obligations for each client.
   */
  async confirmCsvImport(
    orgId: string,
    clients: ValidatedClient[],
  ) {
    if (!clients || clients.length === 0) {
      throw new BadRequestException('No validated clients provided to import.');
    }

    // 1. Verify plan capacity
    const sub = await this.billingService.getSubscription(orgId);
    const currentBusinesses = sub.usage.businessesCount;
    const maxBusinesses = sub.planConfig.maxBusinesses;
    const remainingSlots = Math.max(0, maxBusinesses - currentBusinesses);

    if (clients.length > remainingSlots) {
      throw new ForbiddenException(
        `Plan limit exceeded: Your current plan allows ${remainingSlots} more business(es), but you are attempting to import ${clients.length}. Please upgrade to Pro for unlimited clients.`,
      );
    }

    const createdClients: Array<{ id: string; name: string }> = [];
    let totalObligations = 0;

    for (const client of clients) {
      const bizId = `biz_${randomUUID().replace(/-/g, '')}`;

      const newBiz = {
        id: bizId,
        organizationId: orgId,
        name: client.name,
        state: client.state,
        businessType: client.businessType,
        turnoverBracket: client.turnoverBracket,
        hasEmployees: client.hasEmployees,
        gstin: client.gstin,
        panLast4: client.panLast4,
        registrations: client.registrations,
      };

      await this.db.insert(businesses).values(newBiz);
      createdClients.push({ id: bizId, name: client.name });

      // Generate statutory obligations for this client
      const obCount = await this.generator.generateObligationsForBusiness(
        bizId,
        orgId,
        client.agmDate,
      );
      totalObligations += obCount;
    }

    this.logger.log(
      `[CA Import] Successfully imported ${createdClients.length} clients and generated ${totalObligations} obligations for org ${orgId}.`,
    );

    return {
      success: true,
      importedCount: createdClients.length,
      obligationsGenerated: totalObligations,
      clients: createdClients,
    };
  }
}
