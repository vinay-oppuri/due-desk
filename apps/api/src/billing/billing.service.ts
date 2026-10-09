import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  subscriptions,
  invoices,
  businesses,
  documents,
  memberships,
  eq,
  desc,
  count,
  sum,
} from '@repo/db';
import { env } from '@repo/env';
import {
  getPlanConfig,
  canAddBusiness,
  canUseDocumentVault,
  canAddTeamMember,
  isSubscriptionUsable,
  PLAN_CONFIGS,
  type PlanTier,
} from '@repo/rules';
import { DRIZZLE, type DrizzleDB } from '../drizzle/index.js';
import { BillingWebhookService } from './services/billing-webhook.service.js';

export interface CheckoutSessionDto {
  plan: 'standard' | 'pro';
  interval?: 'monthly' | 'annual';
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly webhookService: BillingWebhookService,
  ) {}

  /**
   * Retrieves or auto-provisions the organization's subscription status,
   * plan configuration, current usage, and gating permissions.
   */
  async getSubscription(orgId: string) {
    let [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId))
      .limit(1);

    if (!sub) {
      // Auto-provision default Free subscription
      const newSub = {
        id: `sub_${randomUUID().replace(/-/g, '')}`,
        organizationId: orgId,
        plan: 'free' as const,
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.db.insert(subscriptions).values(newSub);
      sub = newSub as any;
    }

    // Compute current usage across tenant tables
    const [bizCountRes] = await this.db
      .select({ count: count() })
      .from(businesses)
      .where(eq(businesses.organizationId, orgId));

    const [docStorageRes] = await this.db
      .select({ total: sum(documents.fileSize) })
      .from(documents)
      .where(eq(documents.organizationId, orgId));

    const [memberCountRes] = await this.db
      .select({ count: count() })
      .from(memberships)
      .where(eq(memberships.organizationId, orgId));

    const businessesCount = Number(bizCountRes?.count || 0);
    const storageBytes = Number(docStorageRes?.total || 0);
    const teamMembersCount = Number(memberCountRes?.count || 0);

    const planConfig = getPlanConfig(sub.plan);
    const usable = isSubscriptionUsable(sub.status, sub.currentPeriodEnd);

    return {
      subscription: sub,
      planConfig,
      usage: {
        businessesCount,
        storageBytes,
        teamMembersCount,
      },
      permissions: {
        canAddBusiness: canAddBusiness(sub.plan, businessesCount),
        canUseDocumentVault: canUseDocumentVault(sub.plan),
        canAddTeamMember: canAddTeamMember(sub.plan, teamMembersCount),
        isUsable: usable,
      },
    };
  }

  /**
   * Creates a checkout session configuration for Razorpay hosted checkout.
   */
  async createCheckoutSession(orgId: string, dto: CheckoutSessionDto) {
    const plan = dto.plan;
    if (plan !== 'standard' && plan !== 'pro') {
      throw new BadRequestException('Invalid plan selected. Choose standard or pro.');
    }

    const interval = dto.interval || 'monthly';
    const config = PLAN_CONFIGS[plan];
    const priceInr = interval === 'annual' ? config.priceAnnualInr : config.priceMonthlyInr;
    const amountInPaise = priceInr * 100;

    const orderId = `order_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    return {
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_mock_id',
      organizationId: orgId,
      plan,
      interval,
      amount: amountInPaise,
      currency: 'INR',
      orderId,
      name: `DueDesk ${config.name}`,
      description: `${interval === 'annual' ? 'Annual' : 'Monthly'} Subscription (${config.maxBusinesses === Infinity ? 'Unlimited' : config.maxBusinesses} businesses)`,
      notes: {
        organizationId: orgId,
        plan,
        interval,
      },
    };
  }

  /**
   * Processes incoming Razorpay webhooks via BillingWebhookService.
   */
  async handleWebhook(signature: string | undefined, payload: any, rawBody: string) {
    return this.webhookService.handleWebhook(signature, payload, rawBody);
  }

  /**
   * Test/Dev environment plan upgrade for automated tests and local trials.
   */
  async testUpgradePlan(orgId: string, plan: PlanTier) {
    const nextPeriodEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000);

    const [existingSub] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId))
      .limit(1);

    if (existingSub) {
      await this.db
        .update(subscriptions)
        .set({
          plan,
          status: 'active',
          currentPeriodEnd: nextPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.organizationId, orgId));
    } else {
      await this.db.insert(subscriptions).values({
        id: `sub_${randomUUID().replace(/-/g, '')}`,
        organizationId: orgId,
        plan,
        status: 'active',
        currentPeriodEnd: nextPeriodEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return { success: true, organizationId: orgId, plan, status: 'active' };
  }

  /**
   * Retrieves invoices for an organization.
   */
  async getInvoices(orgId: string) {
    return await this.db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, orgId))
      .orderBy(desc(invoices.createdAt));
  }
}
