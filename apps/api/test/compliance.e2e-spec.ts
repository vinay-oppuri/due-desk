import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { auth, getLatestOtpForTesting } from '@repo/auth/server';
import { db, businesses, memberships, obligations, eq } from '@repo/db';

describe('Phase 4: Compliance Engine & Calendar API (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  const timestamp = Date.now();
  const ownerEmail = `compliance_owner_${timestamp}@test.com`;

  let sessionCookie: string;
  let orgId: string;
  let createdBizId: string;
  let testObligationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;

    // 1. Sign in via Email OTP
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

    // Find auto-provisioned organization
    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userData.user.id));
    orgId = membership!.organizationId;
  });

  afterAll(async () => {
    if (createdBizId) {
      await db.delete(obligations).where(eq(obligations.organizationId, orgId));
      await db.delete(businesses).where(eq(businesses.organizationId, orgId));
    }
    await app.close();
  });

  it('1. POST /api/businesses creates business and generates obligations automatically', async () => {
    const res = await request(server)
      .post('/api/businesses')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Nexus Cloud Technologies Pvt Ltd',
        state: 'KA',
        businessType: 'pvt_ltd',
        turnoverBracket: '1.5Cr-5Cr',
        hasEmployees: true,
        gstin: '29ABCDE1234F1Z5',
        registrations: {
          gst: true,
          pf: true,
          esi: true,
          pt: true,
        },
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Nexus Cloud Technologies Pvt Ltd');
    expect(res.body.state).toBe('KA');
    expect(res.body.obligationsGenerated).toBeGreaterThan(0);

    createdBizId = res.body.id;
  });

  it('2. GET /api/obligations returns dated statutory obligations with status metadata', async () => {
    const res = await request(server)
      .get('/api/obligations')
      .set('Cookie', sessionCookie)
      .expect(200);

    const list = res.body as Array<{
      id: string;
      formCode: string;
      dueDate: string;
      status: string;
      periodLabel: string;
      isDueSoon: boolean;
      isLate: boolean;
    }>;

    expect(list.length).toBeGreaterThan(0);

    // Save first obligation ID for detail tests
    testObligationId = list[0]!.id;

    // Verify key compliance forms are generated (e.g. GSTR-3B, EPF, PT)
    const formCodes = list.map((item) => item.formCode);
    expect(formCodes.some((code) => code.includes('GSTR'))).toBe(true);
    expect(formCodes.some((code) => code.includes('EPF'))).toBe(true);
  });

  it('3. GET /api/obligations/:id returns document checklist, portal link, and disclaimer', async () => {
    const res = await request(server)
      .get(`/api/obligations/${testObligationId}`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(res.body.id).toBe(testObligationId);
    expect(res.body.sourceUrl).toBeDefined();
    expect(Array.isArray(res.body.documentChecklist)).toBe(true);
    expect(res.body.documentChecklist.length).toBeGreaterThan(0);
    expect(res.body.disclaimer).toContain('Reminder tool, not tax advice');
  });

  it('4. POST /api/obligations/:id/file marks obligation as filed and logs history', async () => {
    const res = await request(server)
      .post(`/api/obligations/${testObligationId}/file`)
      .set('Cookie', sessionCookie)
      .send({
        notes: 'Filed on government portal with ARN 123456789',
      })
      .expect(201);

    expect(res.body.id).toBe(testObligationId);
    expect(res.body.status).toBe('filed');
    expect(res.body.filingId).toBeDefined();

    // Verify obligation status is updated when queried
    const detail = await request(server)
      .get(`/api/obligations/${testObligationId}`)
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(detail.body.status).toBe('filed');
    expect(detail.body.filingHistory.length).toBeGreaterThan(0);
    expect(detail.body.filingHistory[0].notes).toContain('ARN 123456789');
  });

  it('5. GET /api/calendar/feed.ics returns standard iCalendar format', async () => {
    const res = await request(server)
      .get('/api/calendar/feed.ics')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text).toContain('BEGIN:VCALENDAR');
    expect(res.text).toContain('VERSION:2.0');
    expect(res.text).toContain('BEGIN:VEVENT');
    expect(res.text).toContain('Reminder tool, not tax advice');
    expect(res.text).toContain('END:VCALENDAR');
  });
});
