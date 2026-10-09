import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  businesses,
  complianceRules,
  eq,
  obligations,
  organizations,
  sql,
  user,
} from '@repo/db';
import {
  sendCaDigestEmail,
  type CaDigestClientItem,
} from '@repo/auth/email';
import { DRIZZLE, type DrizzleDB } from '../../drizzle/index.js';

@Injectable()
export class CaDigestService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Generates a preview of the consolidated weekly multi-client compliance digest.
   */
  async getDigestPreview(orgId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) {
      throw new NotFoundException(`Firm ${orgId} not found`);
    }

    // Find pending deadlines that are overdue OR due within next 7 days
    const rows = await this.db
      .select({
        obligationId: obligations.id,
        dueDate: obligations.dueDate,
        status: obligations.status,
        clientName: businesses.name,
        formCode: complianceRules.formCode,
        ruleName: complianceRules.name,
        assigneeName: user.name,
      })
      .from(obligations)
      .innerJoin(businesses, eq(obligations.businessId, businesses.id))
      .innerJoin(complianceRules, eq(obligations.ruleId, complianceRules.id))
      .leftJoin(user, eq(obligations.assignedTo, user.id))
      .where(
        and(
          eq(obligations.organizationId, orgId),
          eq(obligations.status, 'pending'),
          sql`${obligations.dueDate} <= ${in7Days}`,
        ),
      )
      .orderBy(asc(obligations.dueDate), asc(businesses.name));

    let overdueCount = 0;
    let dueSoonCount = 0;

    const items: CaDigestClientItem[] = rows.map((r) => {
      const isLate = r.dueDate < today;
      if (isLate) {
        overdueCount++;
      } else {
        dueSoonCount++;
      }

      return {
        clientName: r.clientName,
        formCode: r.formCode,
        ruleName: r.ruleName,
        dueDate: r.dueDate,
        status: isLate ? 'late' : 'pending',
        assignedToName: r.assigneeName || undefined,
      };
    });

    return {
      firmName: org.name,
      items,
      totalCount: items.length,
      overdueCount,
      dueSoonCount,
    };
  }

  /**
   * Dispatches the single consolidated multi-client digest email to the firm's partner/accountant.
   */
  async sendDigest(orgId: string, recipientEmail: string) {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      throw new BadRequestException('A valid recipient email address is required.');
    }

    const preview = await this.getDigestPreview(orgId);

    const res = await sendCaDigestEmail({
      email: recipientEmail,
      firmName: preview.firmName,
      items: preview.items,
      overdueCount: preview.overdueCount,
      dueSoonCount: preview.dueSoonCount,
    });

    return {
      success: res.success,
      recipientEmail,
      totalDeadlinesIncluded: preview.totalCount,
      overdueCount: preview.overdueCount,
      dueSoonCount: preview.dueSoonCount,
      providerId: res.providerId,
    };
  }
}
