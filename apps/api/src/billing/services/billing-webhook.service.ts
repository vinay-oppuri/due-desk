import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import crypto from 'node:crypto';
import {
  eq,
  invoices,
  subscriptions,
  webhookEvents,
} from '@repo/db';
import { env } from '@repo/env';
import { DRIZZLE, type DrizzleDB } from '../../drizzle/index.js';

@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Processes incoming Razorpay webhooks.
   * Enforces HMAC-SHA256 signature verification and event-level idempotency via webhook_events.
   */
  async handleWebhook(
    signature: string | undefined,
    payload: any,
    rawBody: string,
  ) {
    // 1. Verify webhook signature if secret configured
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret) {
      if (!signature) {
        throw new BadRequestException('Missing x-razorpay-signature header');
      }
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new BadRequestException('Invalid Razorpay webhook signature');
      }
    }

    // 2. Check Idempotency by Event ID
    const eventId = payload?.id || payload?.event_id;
    if (eventId) {
      const [existingEvent] = await this.db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.id, eventId))
        .limit(1);

      if (existingEvent) {
        this.logger.log(`[Webhook Idempotency] Event ${eventId} already processed. Skipping duplicate.`);
        return { received: true, status: 'already_processed', eventId };
      }

      // Record event ID for deduplication
      await this.db.insert(webhookEvents).values({
        id: eventId,
        provider: 'razorpay',
        eventType: payload.event || 'unknown',
        processedAt: new Date(),
      });
    }

    // 3. Process Event
    const event = payload.event;
    this.logger.log(`[Razorpay Webhook] Processing event: ${event}`);

    const subEntity = payload?.payload?.subscription?.entity;
    const paymentEntity = payload?.payload?.payment?.entity;
    const invoiceEntity = payload?.payload?.invoice?.entity;

    const orgId =
      subEntity?.notes?.organizationId ||
      paymentEntity?.notes?.organizationId ||
      invoiceEntity?.notes?.organizationId ||
      payload?.notes?.organizationId ||
      payload?.payload?.subscription?.entity?.notes?.organizationId ||
      payload?.payload?.payment?.entity?.notes?.organizationId ||
      payload?.payload?.invoice?.entity?.notes?.organizationId;

    const targetPlan =
      subEntity?.notes?.plan ||
      paymentEntity?.notes?.plan ||
      invoiceEntity?.notes?.plan ||
      payload?.notes?.plan ||
      'standard';

    try {
      if (
        event === 'subscription.authenticated' ||
        event === 'subscription.activated' ||
        event === 'payment.captured'
      ) {
        if (orgId) {
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
                plan: targetPlan,
                status: 'active',
                razorpaySubscriptionId: subEntity?.id || null,
                razorpayCustomerId: subEntity?.customer_id || paymentEntity?.customer_id || null,
                currentPeriodEnd: nextPeriodEnd,
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.organizationId, orgId));
          } else {
            await this.db
              .insert(subscriptions)
              .values({
                id: `sub_${randomUUID().replace(/-/g, '')}`,
                organizationId: orgId,
                plan: targetPlan,
                status: 'active',
                razorpaySubscriptionId: subEntity?.id || null,
                razorpayCustomerId: subEntity?.customer_id || paymentEntity?.customer_id || null,
                currentPeriodEnd: nextPeriodEnd,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
          }

          this.logger.log(`[Billing] Organization ${orgId} upgraded to ${targetPlan} plan.`);
        }
      } else if (event === 'subscription.charged' || event === 'invoice.paid') {
        if (orgId) {
          const amount = paymentEntity?.amount || invoiceEntity?.amount || 49900;
          const razorpayInvoiceId =
            invoiceEntity?.id ||
            paymentEntity?.invoice_id ||
            paymentEntity?.id ||
            `inv_${randomUUID().slice(0, 8)}`;

          // Check if invoice already recorded
          const [existingInv] = await this.db
            .select()
            .from(invoices)
            .where(eq(invoices.razorpayInvoiceId, razorpayInvoiceId))
            .limit(1);

          if (!existingInv) {
            await this.db.insert(invoices).values({
              id: `inv_${randomUUID().replace(/-/g, '')}`,
              organizationId: orgId,
              amount: amount,
              currency: 'INR',
              status: 'paid',
              razorpayInvoiceId: razorpayInvoiceId,
              pdfUrl: invoiceEntity?.short_url || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      } else if (event === 'subscription.pending' || event === 'subscription.halted') {
        // Failed renewal -> 7-day Grace Period
        if (orgId) {
          await this.db
            .update(subscriptions)
            .set({
              status: 'grace_period',
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.organizationId, orgId));

          this.logger.warn(`[Billing] Organization ${orgId} subscription in grace_period.`);
        }
      } else if (event === 'subscription.cancelled') {
        if (orgId) {
          await this.db
            .update(subscriptions)
            .set({
              plan: 'free',
              status: 'canceled',
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.organizationId, orgId));

          this.logger.log(`[Billing] Organization ${orgId} subscription canceled. Reverted to free.`);
        }
      }
    } catch (err: any) {
      this.logger.error(`[Razorpay Webhook Error]: ${err.message}`, err.stack);
      throw err;
    }

    return { received: true, status: 'processed', event };
  }
}
