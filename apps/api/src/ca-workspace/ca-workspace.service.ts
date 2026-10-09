import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  businesses,
  count,
  eq,
  memberships,
  organizations,
  user,
} from '@repo/db';
import { DRIZZLE, type DrizzleDB } from '../drizzle/index.js';
import {
  CaImportService,
  type CsvClientRow,
  type ValidatedClient,
} from './services/ca-import.service.js';
import {
  CaBoardService,
  type BoardQueryDto,
} from './services/ca-board.service.js';
import { CaDigestService } from './services/ca-digest.service.js';

export interface UpdateFirmDto {
  name?: string;
  type?: 'business' | 'ca_firm';
}

@Injectable()
export class CaWorkspaceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly importService: CaImportService,
    private readonly boardService: CaBoardService,
    private readonly digestService: CaDigestService,
  ) {}

  /**
   * Retrieves CA Firm organization profile and client/staff summary counts.
   */
  async getFirmDetails(orgId: string) {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) {
      throw new NotFoundException(`Firm ${orgId} not found`);
    }

    const [bizCountRes] = await this.db
      .select({ count: count() })
      .from(businesses)
      .where(eq(businesses.organizationId, orgId));

    const [staffCountRes] = await this.db
      .select({ count: count() })
      .from(memberships)
      .where(eq(memberships.organizationId, orgId));

    return {
      organization: org,
      clientCount: Number(bizCountRes?.count || 0),
      staffCount: Number(staffCountRes?.count || 0),
      isCaFirm: org.type === 'ca_firm',
    };
  }

  /**
   * Updates firm profile (e.g. converting organization type to ca_firm or renaming).
   */
  async updateFirm(orgId: string, dto: UpdateFirmDto) {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) {
      throw new NotFoundException(`Firm ${orgId} not found`);
    }

    const updateFields: any = { updatedAt: new Date() };
    if (dto.name) updateFields.name = dto.name;
    if (dto.type) updateFields.type = dto.type;

    await this.db
      .update(organizations)
      .set(updateFields)
      .where(eq(organizations.id, orgId));

    return {
      ...org,
      ...updateFields,
    };
  }

  /**
   * Retrieves firm staff members with roles and profiles.
   */
  async getStaffMembers(orgId: string) {
    const rows = await this.db
      .select({
        membershipId: memberships.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        role: memberships.role,
        createdAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(user, eq(memberships.userId, user.id))
      .where(eq(memberships.organizationId, orgId));

    return rows;
  }

  /**
   * Dry-run validation for CSV client import.
   */
  async previewCsvImport(orgId: string, rows: CsvClientRow[] | string) {
    return this.importService.previewCsvImport(orgId, rows);
  }

  /**
   * Confirm and bulk-insert validated client companies and generate their compliance obligations.
   */
  async confirmCsvImport(orgId: string, clients: ValidatedClient[]) {
    return this.importService.confirmCsvImport(orgId, clients);
  }

  /**
   * Cross-client deadline board query.
   */
  async getBoard(orgId: string, query: BoardQueryDto) {
    return this.boardService.getBoard(orgId, query);
  }

  /**
   * Assign an obligation to a staff member.
   */
  async assignObligation(orgId: string, obligationId: string, assigneeId: string | null) {
    return this.boardService.assignObligation(orgId, obligationId, assigneeId);
  }

  /**
   * Preview weekly consolidated executive digest.
   */
  async getDigestPreview(orgId: string) {
    return this.digestService.getDigestPreview(orgId);
  }

  /**
   * Dispatch consolidated weekly executive digest email.
   */
  async sendDigest(orgId: string, recipientEmail: string) {
    return this.digestService.sendDigest(orgId, recipientEmail);
  }
}
