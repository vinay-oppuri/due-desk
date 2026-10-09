import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { auth, getLatestOtpForTesting } from '@repo/auth/server';
import {
  db,
  businesses,
  invoices,
  memberships,
  organizations,
  subscriptions,
  webhookEvents,
  eq,
} from '@repo/db';
import { env } from '@repo/env';

describe('Phase 8: Billing, Plan Gating & Razorpay Webhooks (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  const timestamp = Date.now();
  const ownerEmail = `billing_owner_${timestamp}@test.com`;
  const webhookSecret = 'test_webhook_secret_key_123';

  let sessionCookie: string;
  let orgId: string;
  let firstBizId: string;

  beforeAll(async () => {
    // Override webhook secret in env for test verification
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;

    // 1. Sign in owner via OTP
    await auth.api.sendVerificationOTP({
      body: { email: ownerEmail, type: 'sign-in' },
    });
    const otp = getLatestOtpForTesting(ownerEmail);
    expect(otp).toBeDefined();

    const res = await auth.api.signInEmailOTP({
      body: { email: ownerEmail, otp: otp! },
      asResponse: true,
    });
    sessionCookie = res.headers.get('set-cookie') ?? '';
    const userData = (await res.json()) as { user: { id: string } };

    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userData.user.id));
    orgId = membership!.organizationId;
  });

  afterAll(async () => {
    if (orgId) {
      await db.delete(invoices).where(eq(invoices.organizationId, orgId));
      await db.delete(subscriptions).where(eq(subscriptions.organizationId, orgId));
      await db.delete(businesses).where(eq(businesses.organizationId, orgId));
      await db.delete(organizations).where(eq(organizations.id, orgId));
    }
    await app.close();
  });

  it('1. GET /api/billing/subscription returns default Free plan for new organization', async () => {
    const res = await request(server)
      .get('/api/billing/subscription')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(res.body.subscription.plan).toBe('free');
    expect(res.body.subscription.status).toBe('active');
    expect(res.body.planConfig.maxBusinesses).toBe(1);
    expect(res.body.permissions.canAddBusiness).toBe(true);
    expect(res.body.permissions.canUseDocumentVault).toBe(false);
  });

  it('2. Free plan user creates their first business successfully', async () => {
    const res = await request(server)
      .post('/api/businesses')
      .set('Cookie', sessionCookie)
      .send({
        name: 'First Alpha Enterprises',
        state: 'KA',
        businessType: 'pvt_ltd',
        turnoverBracket: 'under_1cr',
        hasEmployees: true,
        registrations: { gst: true },
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    firstBizId = res.body.id;
  });

  it('3. Plan Gating: Free plan user blocked from creating a 2nd business (403 Forbidden)', async () => {
    const res = await request(server)
      .post('/api/businesses')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Second Beta Enterprises',
        state: 'MH',
        businessType: 'llp',
        turnoverBracket: 'under_1cr',
        hasEmployees: false,
      })
      .expect(403);

    expect(res.body.message).toContain('Plan limit reached');
  });

  it('4. Plan Gating: Free plan user blocked from using Document Vault (403 Forbidden)', async () => {
    const res = await request(server)
      .post('/api/documents/upload-url')
      .set('Cookie', sessionCookie)
      .send({
        fileName: 'challan_march.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024 * 50, // 50KB
      })
      .expect(403);

    expect(res.body.message).toContain('Document vault is only available on Standard and Pro plans');
  });

  it('5. Webhook: Rejects webhook payload with invalid signature (400 Bad Request)', async () => {
    const payload = {
      id: `evt_test_${randomUUID().slice(0, 8)}`,
      event: 'subscription.activated',
      payload: { subscription: { entity: { notes: { organizationId: orgId, plan: 'standard' } } } },
    };

    await request(server)
      .post('/api/billing/webhook')
      .set('x-razorpay-signature', 'invalid_bogus_signature')
      .send(payload)
      .expect(400);
  });

  it('6. Webhook: Valid signature upgrades organization from Free to Standard plan', async () => {
    const eventId = `evt_act_${randomUUID().slice(0, 8)}`;
    const payload = {
      id: eventId,
      event: 'subscription.activated',
      payload: {
        subscription: {
          entity: {
            id: 'sub_rzp_mock_123',
            customer_id: 'cust_rzp_123',
            notes: { organizationId: orgId, plan: 'standard' },
          },
        },
      },
    };

    const rawBody = JSON.stringify(payload);
    const validSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const res = await request(server)
      .post('/api/billing/webhook')
      .set('x-razorpay-signature', validSignature)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(201);

    expect(res.body.received).toBe(true);
    expect(res.body.status).toBe('processed');

    // Verify database state upgraded
    const [updatedSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, orgId));

    expect(updatedSub).toBeDefined();
    expect(updatedSub!.plan).toBe('standard');
    expect(updatedSub!.status).toBe('active');
  });

  it('7. Standard plan user can now create additional businesses and use Document Vault', async () => {
    // Can now create 2nd business
    const bizRes = await request(server)
      .post('/api/businesses')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Second Beta Enterprises',
        state: 'MH',
        businessType: 'llp',
        turnoverBracket: 'under_1cr',
        hasEmployees: false,
      })
      .expect(201);

    expect(bizRes.body.id).toBeDefined();

    // Can now access Document Vault
    const docRes = await request(server)
      .post('/api/documents/upload-url')
      .set('Cookie', sessionCookie)
      .send({
        fileName: 'challan_march.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024 * 50,
      })
      .expect(201);

    expect(docRes.body.uploadUrl).toBeDefined();
  });

  it('8. Webhook Idempotency: Replaying duplicate webhook event returns already_processed', async () => {
    const duplicateEventId = `evt_dup_${randomUUID().slice(0, 8)}`;
    const payload = {
      id: duplicateEventId,
      event: 'subscription.activated',
      payload: {
        subscription: {
          entity: {
            id: 'sub_rzp_mock_123',
            notes: { organizationId: orgId, plan: 'standard' },
          },
        },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    // First delivery
    const firstRes = await request(server)
      .post('/api/billing/webhook')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(201);

    expect(firstRes.body.status).toBe('processed');

    // Duplicate delivery
    const secondRes = await request(server)
      .post('/api/billing/webhook')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(201);

    expect(secondRes.body.status).toBe('already_processed');
  });

  it('9. Webhook: invoice.paid event records statutory invoice with amount in INR', async () => {
    const invoiceEventId = `evt_inv_${randomUUID().slice(0, 8)}`;
    const invoiceId = `inv_rzp_${randomUUID().slice(0, 8)}`;
    const payload = {
      id: invoiceEventId,
      event: 'invoice.paid',
      notes: { organizationId: orgId },
      payload: {
        invoice: {
          entity: {
            id: invoiceId,
            amount: 49900, // ₹499 in paise
            short_url: 'https://invoicing.razorpay.com/inv_sample.pdf',
          },
        },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    await request(server)
      .post('/api/billing/webhook')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(201);

    const invRes = await request(server)
      .get('/api/billing/invoices')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(Array.isArray(invRes.body)).toBe(true);
    expect(invRes.body.length).toBeGreaterThan(0);
    expect(invRes.body[0].amount).toBe(49900);
    expect(invRes.body[0].currency).toBe('INR');
    expect(invRes.body[0].status).toBe('paid');
  });

  it('10. Grace Period: subscription.halted transitions organization to grace_period without service cut-off', async () => {
    const haltedEventId = `evt_halt_${randomUUID().slice(0, 8)}`;
    const payload = {
      id: haltedEventId,
      event: 'subscription.halted',
      notes: { organizationId: orgId },
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    await request(server)
      .post('/api/billing/webhook')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(201);

    const subRes = await request(server)
      .get('/api/billing/subscription')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(subRes.body.subscription.status).toBe('grace_period');
    expect(subRes.body.permissions.isUsable).toBe(true); // Reminders & service continue during 7-day grace
  });
});
