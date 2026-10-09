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
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  memberships,
  obligations,
  sql,
  user,
} from '@repo/db';
import { DRIZZLE, type DrizzleDB } from '../../drizzle/index.js';

export interface BoardQueryDto {
  clientId?: string;
  formCode?: string;
  state?: string;
  assigneeId?: string;
  status?: string;
  timeframe?: 'this_week' | 'this_month' | 'overdue' | 'all';
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class CaBoardService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Retrieves cross-client statutory compliance board with fast filtering, summary stats, and pagination.
   */
  async getBoard(orgId: string, query: BoardQueryDto = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7); // YYYY-MM

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(200, Math.max(1, Number(query.limit || 50)));
    const offset = (page - 1) * limit;

    // 1. Compute Cross-Client Summary Statistics in a single fast aggregation
    const [statsResult] = await this.db
      .select({
        totalClients: count(sql`DISTINCT ${businesses.id}`),
        totalPending: count(sql`CASE WHEN ${obligations.status} = 'pending' THEN 1 END`),
        overdueCount: count(
          sql`CASE WHEN ${obligations.status} = 'pending' AND ${obligations.dueDate} < ${today} THEN 1 END`,
        ),
        dueThisWeek: count(
          sql`CASE WHEN ${obligations.status} = 'pending' AND ${obligations.dueDate} >= ${today} AND ${obligations.dueDate} <= ${in7Days} THEN 1 END`,
        ),
        filedCount: count(sql`CASE WHEN ${obligations.status} = 'filed' THEN 1 END`),
      })
      .from(obligations)
      .innerJoin(businesses, eq(obligations.businessId, businesses.id))
      .where(eq(obligations.organizationId, orgId));

    // 2. Build Filter Conditions for Master Board
    const conditions = [eq(obligations.organizationId, orgId)];

    if (query.clientId) {
      conditions.push(eq(obligations.businessId, query.clientId));
    }
    if (query.formCode) {
      conditions.push(eq(complianceRules.formCode, query.formCode.toUpperCase()));
    }
    if (query.state) {
      conditions.push(eq(businesses.state, query.state.toUpperCase()));
    }
    if (query.status) {
      conditions.push(eq(obligations.status, query.status));
    }

    if (query.assigneeId) {
      if (query.assigneeId === 'unassigned') {
        conditions.push(sql`${obligations.assignedTo} IS NULL`);
      } else {
        conditions.push(eq(obligations.assignedTo, query.assigneeId));
      }
    }

    if (query.timeframe === 'this_week') {
      conditions.push(gte(obligations.dueDate, today));
      conditions.push(lte(obligations.dueDate, in7Days));
    } else if (query.timeframe === 'this_month') {
      conditions.push(sql`${obligations.dueDate}::text LIKE ${`${currentMonth}%`}`);
    } else if (query.timeframe === 'overdue') {
      conditions.push(sql`${obligations.dueDate} < ${today} AND ${obligations.status} != 'filed'`);
    }

    // 3. Query filtered items with joins for business, rule, and assignee
    const rows = await this.db
      .select({
        obligationId: obligations.id,
        periodLabel: obligations.periodLabel,
        dueDate: obligations.dueDate,
        status: obligations.status,
        assignedToId: obligations.assignedTo,
        businessId: businesses.id,
        businessName: businesses.name,
        businessState: businesses.state,
        businessType: businesses.businessType,
        ruleId: complianceRules.id,
        formCode: complianceRules.formCode,
        formName: complianceRules.name,
        sourceUrl: complianceRules.sourceUrl,
        assigneeName: user.name,
        assigneeEmail: user.email,
      })
      .from(obligations)
      .innerJoin(businesses, eq(obligations.businessId, businesses.id))
      .innerJoin(complianceRules, eq(obligations.ruleId, complianceRules.id))
      .leftJoin(user, eq(obligations.assignedTo, user.id))
      .where(and(...conditions))
      .orderBy(asc(obligations.dueDate), asc(businesses.name))
      .limit(limit)
      .offset(offset);

    // 4. Transform and enrich rows with days remaining and dynamic late status
    const items = rows.map((r) => {
      let currentStatus = r.status;
      if (currentStatus === 'pending' && r.dueDate < today) {
        currentStatus = 'late';
      }

      const dueMs = new Date(r.dueDate).getTime();
      const nowMs = new Date(today).getTime();
      const diffDays = Math.round((dueMs - nowMs) / (1000 * 60 * 60 * 24));

      return {
        id: r.obligationId,
        periodLabel: r.periodLabel,
        dueDate: r.dueDate,
        status: currentStatus,
        daysRemaining: diffDays,
        isDueSoon: currentStatus === 'pending' && diffDays >= 0 && diffDays <= 7,
        isLate: currentStatus === 'late',
        business: {
          id: r.businessId,
          name: r.businessName,
          state: r.businessState,
          businessType: r.businessType,
        },
        rule: {
          id: r.ruleId,
          formCode: r.formCode,
          name: r.formName,
          sourceUrl: r.sourceUrl,
        },
        assignedTo: r.assignedToId
          ? {
              id: r.assignedToId,
              name: r.assigneeName || 'Team Member',
              email: r.assigneeEmail || '',
            }
          : null,
      };
    });

    return {
      summary: {
        totalClients: Number(statsResult?.totalClients || 0),
        totalPending: Number(statsResult?.totalPending || 0),
        dueThisWeek: Number(statsResult?.dueThisWeek || 0),
        overdueCount: Number(statsResult?.overdueCount || 0),
        filedCount: Number(statsResult?.filedCount || 0),
      },
      items,
      pagination: {
        page,
        limit,
        returnedCount: items.length,
      },
    };
  }

  /**
   * Assigns an obligation to a staff member (accountant/CA) within the firm.
   */
  async assignObligation(
    orgId: string,
    obligationId: string,
    assigneeId: string | null,
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
      throw new NotFoundException(`Obligation ${obligationId} not found in current firm`);
    }

    if (assigneeId) {
      // Verify assignee belongs to organization
      const [membership] = await this.db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, orgId),
            eq(memberships.userId, assigneeId),
          ),
        );

      if (!membership) {
        throw new BadRequestException('Selected assignee is not a member of this firm.');
      }
    }

    await this.db
      .update(obligations)
      .set({
        assignedTo: assigneeId || null,
        updatedAt: new Date(),
      })
      .where(eq(obligations.id, obligationId));

    let assigneeDetails: any = null;
    if (assigneeId) {
      const [u] = await this.db.select().from(user).where(eq(user.id, assigneeId));
      if (u) {
        assigneeDetails = { id: u.id, name: u.name, email: u.email };
      }
    }

    return {
      success: true,
      obligationId,
      assignedTo: assigneeDetails,
    };
  }
}
