import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  and,
  businesses,
  eq,
  filings,
  obligations,
} from '@repo/db';
import { DRIZZLE, type DrizzleDB } from '../drizzle/index.js';
import { BillingService } from '../billing/billing.service.js';
import { ComplianceGeneratorService } from './services/compliance-generator.service.js';
import { ComplianceCalendarService } from './services/compliance-calendar.service.js';

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
    private readonly billingService: BillingService,
    private readonly generator: ComplianceGeneratorService,
    private readonly calendar: ComplianceCalendarService,
  ) {}

  /**
   * Creates a business profile and automatically generates its compliance obligations.
   */
  async createBusiness(orgId: string, dto: CreateBusinessDto) {
    // 1. Verify subscription plan limits
    const subInfo = await this.billingService.getSubscription(orgId);
    if (!subInfo.permissions.canAddBusiness) {
      throw new ForbiddenException(
        `Plan limit reached: The ${subInfo.planConfig.name} plan allows up to ${subInfo.planConfig.maxBusinesses} business(es). Please upgrade to Standard or Pro to add more.`,
      );
    }

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
    const generatedCount = await this.generator.generateObligationsForBusiness(
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
    return this.generator.generateObligationsForBusiness(
      businessId,
      orgId,
      agmDate,
    );
  }

  /**
   * Retrieves obligations for an organization with optional filtering.
   */
  async getObligations(
    orgId: string,
    filters: {
      businessId?: string;
      month?: string;
      upcomingDays?: number;
      status?: string;
    } = {},
  ) {
    return this.calendar.getObligations(orgId, filters);
  }

  /**
   * Retrieves single obligation details with required checklist and filing history.
   */
  async getObligationDetail(orgId: string, obligationId: string) {
    return this.calendar.getObligationDetail(orgId, obligationId);
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
   * Generates standard iCalendar (.ics) feed string for syncing with calendar apps.
   */
  async generateIcsFeed(orgId: string, businessId?: string): Promise<string> {
    return this.calendar.generateIcsFeed(orgId, businessId);
  }
}
