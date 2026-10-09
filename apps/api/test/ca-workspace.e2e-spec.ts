import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { auth, getLatestOtpForTesting } from '@repo/auth/server';
import {
  db,
  businesses,
  memberships,
  obligations,
  organizations,
  subscriptions,
  eq,
} from '@repo/db';

describe('Phase 9: CA Multi-Client Workspace & Board (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  const timestamp = Date.now();
  const firmOwnerEmail = `ca_partner_${timestamp}@test.com`;
  const tenantBEmail = `other_firm_${timestamp}@test.com`;

  let firmSessionCookie: string;
  let firmOrgId: string;
  let firmOwnerId: string;

  let tenantBSessionCookie: string;
  let tenantBOrgId: string;

  let testClientIds: string[] = [];
  let testObligationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;

    // 1. Sign in CA Firm Owner
    await auth.api.sendVerificationOTP({
      body: { email: firmOwnerEmail, type: 'sign-in' },
    });
    const otpA = getLatestOtpForTesting(firmOwnerEmail);
    expect(otpA).toBeDefined();

    const resA = await auth.api.signInEmailOTP({
      body: { email: firmOwnerEmail, otp: otpA! },
      asResponse: true,
    });
    firmSessionCookie = resA.headers.get('set-cookie') ?? '';
    const userAData = (await resA.json()) as { user: { id: string } };
    firmOwnerId = userAData.user.id;

    const [memA] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, firmOwnerId));
    firmOrgId = memA!.organizationId;

    // 2. Sign in Tenant B for cross-tenant isolation tests
    await auth.api.sendVerificationOTP({
      body: { email: tenantBEmail, type: 'sign-in' },
    });
    const otpB = getLatestOtpForTesting(tenantBEmail);
    const resB = await auth.api.signInEmailOTP({
      body: { email: tenantBEmail, otp: otpB! },
      asResponse: true,
    });
    tenantBSessionCookie = resB.headers.get('set-cookie') ?? '';
    const userBData = (await resB.json()) as { user: { id: string } };

    const [memB] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userBData.user.id));
    tenantBOrgId = memB!.organizationId;
  });

  afterAll(async () => {
    if (firmOrgId) {
      await db.delete(obligations).where(eq(obligations.organizationId, firmOrgId));
      await db.delete(businesses).where(eq(businesses.organizationId, firmOrgId));
      await db.delete(subscriptions).where(eq(subscriptions.organizationId, firmOrgId));
      await db.delete(organizations).where(eq(organizations.id, firmOrgId));
    }
    if (tenantBOrgId) {
      await db.delete(obligations).where(eq(obligations.organizationId, tenantBOrgId));
      await db.delete(businesses).where(eq(businesses.organizationId, tenantBOrgId));
      await db.delete(subscriptions).where(eq(subscriptions.organizationId, tenantBOrgId));
      await db.delete(organizations).where(eq(organizations.id, tenantBOrgId));
    }
    await app.close();
  });

  it('1. GET /api/ca/firm retrieves organization details and upgrades to ca_firm', async () => {
    const res1 = await request(server)
      .get('/api/ca/firm')
      .set('Cookie', firmSessionCookie)
      .expect(200);

    expect(res1.body.organization.id).toBe(firmOrgId);
    expect(res1.body.clientCount).toBe(0);

    // Upgrade organization type to ca_firm
    const res2 = await request(server)
      .patch('/api/ca/firm')
      .set('Cookie', firmSessionCookie)
      .send({
        name: 'Apex Tax & Advisory LLP',
        type: 'ca_firm',
      })
      .expect(200);

    expect(res2.body.name).toBe('Apex Tax & Advisory LLP');
    expect(res2.body.type).toBe('ca_firm');
  });

  it('2. GET /api/ca/staff returns firm team members with roles', async () => {
    const res = await request(server)
      .get('/api/ca/staff')
      .set('Cookie', firmSessionCookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const ownerMember = res.body.find((m: any) => m.userId === firmOwnerId);
    expect(ownerMember).toBeDefined();
    expect(ownerMember.role).toBe('owner');
  });

  it('3. POST /api/ca/clients/import/preview validates CSV with dry-run error detection', async () => {
    const csvContent = `name,state,businessType,turnoverBracket,hasEmployees,gstin,registrations
Zenith Infra Pvt Ltd,KA,pvt_ltd,1.5Cr-5Cr,true,29ABCDE1234F1Z5,gst;pf;esi;pt
Invalid State Co,XX,pvt_ltd,<40L,false,,
Bad GSTIN LLC,MH,llp,<40L,false,INVALID_GST_123,
Solace Retail Pvt Ltd,DL,pvt_ltd,40L-1.5Cr,true,07AAAAA0000A1Z5,gst;pt`;

    const res = await request(server)
      .post('/api/ca/clients/import/preview')
      .set('Cookie', firmSessionCookie)
      .send({ csvContent })
      .expect(201);

    expect(res.body.totalRows).toBe(4);
    expect(res.body.validCount).toBe(2);
    expect(res.body.errorCount).toBe(2);
    expect(res.body.errors.some((e: any) => e.name === 'Invalid State Co' && e.field === 'state')).toBe(true);
    expect(res.body.errors.some((e: any) => e.name === 'Bad GSTIN LLC' && e.field === 'gstin')).toBe(true);
    expect(res.body.preview.length).toBe(2);
  });

  it('4. Plan Gating: Free plan blocks importing multiple clients past plan limit', async () => {
    // Current firm has 0 businesses, Free plan allows max 1
    const validBatch = [
      {
        name: 'Client Alpha Ltd',
        state: 'KA',
        businessType: 'pvt_ltd',
        turnoverBracket: '<40L',
        hasEmployees: false,
        gstin: null,
        panLast4: null,
        registrations: { gst: false, pt: true },
        agmDate: '2026-09-30',
        row: 1,
      },
      {
        name: 'Client Beta LLP',
        state: 'MH',
        businessType: 'llp',
        turnoverBracket: '<40L',
        hasEmployees: false,
        gstin: null,
        panLast4: null,
        registrations: { gst: false, pt: true },
        agmDate: '2026-09-30',
        row: 2,
      },
    ];

    const res = await request(server)
      .post('/api/ca/clients/import/confirm')
      .set('Cookie', firmSessionCookie)
      .send({ clients: validBatch })
      .expect(403);

    expect(res.body.message).toContain('Plan limit exceeded');
  });

  it('5. POST /api/ca/clients/import/confirm imports clients and generates statutory obligations (on Pro plan)', async () => {
    // Upgrade firm to Pro plan to support unlimited clients
    await request(server)
      .post('/api/billing/test-upgrade')
      .set('Cookie', firmSessionCookie)
      .send({ plan: 'pro' })
      .expect(201);

    const validBatch = [
      {
        name: 'Zenith Infra Pvt Ltd',
        state: 'KA',
        businessType: 'pvt_ltd',
        turnoverBracket: '1.5Cr-5Cr',
        hasEmployees: true,
        gstin: '29ABCDE1234F1Z5',
        panLast4: '5566',
        registrations: { gst: true, pf: true, esi: true, pt: true },
        agmDate: '2026-09-30',
        row: 1,
      },
      {
        name: 'Solace Retail Pvt Ltd',
        state: 'DL',
        businessType: 'pvt_ltd',
        turnoverBracket: '40L-1.5Cr',
        hasEmployees: true,
        gstin: '07AAAAA0000A1Z5',
        panLast4: '7788',
        registrations: { gst: true, pt: true },
        agmDate: '2026-09-30',
        row: 2,
      },
    ];

    const res = await request(server)
      .post('/api/ca/clients/import/confirm')
      .set('Cookie', firmSessionCookie)
      .send({ clients: validBatch })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.importedCount).toBe(2);
    expect(res.body.obligationsGenerated).toBeGreaterThan(0);
    expect(res.body.clients.length).toBe(2);

    testClientIds = res.body.clients.map((c: any) => c.id);
  });

  it('6. GET /api/ca/board returns master cross-client deadline board with summary metrics and filters', async () => {
    const res = await request(server)
      .get('/api/ca/board')
      .set('Cookie', firmSessionCookie)
      .expect(200);

    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.totalClients).toBe(2);
    expect(res.body.summary.totalPending).toBeGreaterThan(0);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);

    const firstItem = res.body.items[0];
    expect(firstItem.id).toBeDefined();
    expect(firstItem.business.name).toBeDefined();
    expect(firstItem.rule.formCode).toBeDefined();
    expect(firstItem.dueDate).toBeDefined();
    testObligationId = firstItem.id;

    // Filter by specific client
    const resFilterClient = await request(server)
      .get(`/api/ca/board?clientId=${testClientIds[0]}`)
      .set('Cookie', firmSessionCookie)
      .expect(200);

    expect(resFilterClient.body.items.every((it: any) => it.business.id === testClientIds[0])).toBe(true);

    // Filter by timeframe=this_month
    const resFilterMonth = await request(server)
      .get('/api/ca/board?timeframe=this_month')
      .set('Cookie', firmSessionCookie)
      .expect(200);

    expect(Array.isArray(resFilterMonth.body.items)).toBe(true);
  });

  it('7. PATCH /api/ca/obligations/:id/assign assigns statutory obligation to staff member', async () => {
    const res = await request(server)
      .patch(`/api/ca/obligations/${testObligationId}/assign`)
      .set('Cookie', firmSessionCookie)
      .send({ assigneeId: firmOwnerId })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.assignedTo).toBeDefined();
    expect(res.body.assignedTo.id).toBe(firmOwnerId);

    // Check board reflects assignee
    const boardRes = await request(server)
      .get(`/api/ca/board?assigneeId=${firmOwnerId}`)
      .set('Cookie', firmSessionCookie)
      .expect(200);

    expect(boardRes.body.items.some((it: any) => it.id === testObligationId)).toBe(true);
  });

  it('8. GET /api/ca/digest/preview and POST /api/ca/digest/send generate single consolidated digest email', async () => {
    // 1. Preview consolidated digest
    const previewRes = await request(server)
      .get('/api/ca/digest/preview')
      .set('Cookie', firmSessionCookie)
      .expect(200);

    expect(previewRes.body.firmName).toBe('Apex Tax & Advisory LLP');
    expect(Array.isArray(previewRes.body.items)).toBe(true);
    expect(previewRes.body.totalCount).toBeGreaterThanOrEqual(0);

    // 2. Dispatch consolidated digest email (1 single email for entire firm)
    const sendRes = await request(server)
      .post('/api/ca/digest/send')
      .set('Cookie', firmSessionCookie)
      .send({ email: firmOwnerEmail })
      .expect(201);

    expect(sendRes.body.success).toBe(true);
    expect(sendRes.body.recipientEmail).toBe(firmOwnerEmail);
    expect(sendRes.body.totalDeadlinesIncluded).toBe(previewRes.body.totalCount);
  });

  it('9. Cross-Tenant Isolation: Tenant B cannot view or manage CA Firm A clients or deadline board', async () => {
    // Tenant B queries deadline board -> receives empty or only Tenant B data
    const resBoardB = await request(server)
      .get('/api/ca/board')
      .set('Cookie', tenantBSessionCookie)
      .expect(200);

    expect(resBoardB.body.summary.totalClients).toBe(0);
    expect(resBoardB.body.items.length).toBe(0);

    // Tenant B tries to assign Firm A obligation -> 404 Not Found
    await request(server)
      .patch(`/api/ca/obligations/${testObligationId}/assign`)
      .set('Cookie', tenantBSessionCookie)
      .send({ assigneeId: 'fake_user_id' })
      .expect(404);
  });
});
