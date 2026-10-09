import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { auth, getLatestOtpForTesting } from '@repo/auth/server';
import {
  db,
  businesses,
  obligations,
  reminders,
  deliveryLog,
  ruleAuditLog,
  complianceRules,
  memberships,
  eq,
} from '@repo/db';
import { randomUUID } from 'node:crypto';

describe('Phase 7: Reliability, Security & Observability (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  const timestamp = Date.now();
  const adminEmail = `admin_obs_${timestamp}@test.com`;

  let sessionCookie: string;
  let orgId: string;
  let testBusinessId: string;
  let testObligationId: string;
  let testDeadReminderId: string;
  let testDeliveryLogId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;

    // 1. Sign in admin via OTP
    await auth.api.sendVerificationOTP({
      body: { email: adminEmail, type: 'sign-in' },
    });
    const otp = getLatestOtpForTesting(adminEmail);
    expect(otp).toBeDefined();

    const res = await auth.api.signInEmailOTP({
      body: { email: adminEmail, otp: otp! },
      asResponse: true,
    });
    sessionCookie = res.headers.get('set-cookie') ?? '';
    const userData = (await res.json()) as { user: { id: string } };

    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userData.user.id));
    orgId = membership!.organizationId;

    // 2. Create test business & obligation
    testBusinessId = `biz_obs_${randomUUID().slice(0, 8)}`;
    await db.insert(businesses).values({
      id: testBusinessId,
      organizationId: orgId,
      name: 'Observability Test Corp',
      state: 'KA',
      businessType: 'pvt_ltd',
      turnoverBracket: 'under_1cr',
      hasEmployees: true,
      registrations: { gst: true },
    });

    const [seededRule] = await db.select().from(complianceRules).limit(1);
    expect(seededRule).toBeDefined();

    testObligationId = `ob_obs_${randomUUID().slice(0, 8)}`;
    await db.insert(obligations).values({
      id: testObligationId,
      organizationId: orgId,
      businessId: testBusinessId,
      ruleId: seededRule!.id,
      ruleVersion: seededRule!.version,
      periodLabel: 'March 2026',
      dueDate: '2026-04-20',
      status: 'pending',
    });

    // 3. Create test dead reminder
    testDeadReminderId = `rem_dead_${randomUUID().slice(0, 8)}`;
    await db.insert(reminders).values({
      id: testDeadReminderId,
      organizationId: orgId,
      obligationId: testObligationId,
      channel: 'email',
      offsetDays: 7,
      sendAt: new Date(Date.now() - 3600 * 1000),
      state: 'dead',
      attempts: 5,
      lastError: 'Simulated SMTP connection timeout after 5 retries',
    });

    // 4. Create test delivery failure log
    testDeliveryLogId = `log_fail_${randomUUID().slice(0, 8)}`;
    await db.insert(deliveryLog).values({
      id: testDeliveryLogId,
      reminderId: testDeadReminderId,
      attemptAt: new Date(),
      result: 'failure',
      providerId: 'resend_mock',
      error: 'Simulated 500 upstream gateway error',
    });

    // 5. Create test rule audit log
    await db.insert(ruleAuditLog).values({
      id: `audit_${randomUUID().slice(0, 8)}`,
      ruleId: seededRule!.id,
      changedBy: 'lead_tax_specialist',
      change: 'Updated statutory shift on holiday setting',
      reason: 'Align with official state gazette notification',
    });
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(deliveryLog).where(eq(deliveryLog.id, testDeliveryLogId));
    await db.delete(reminders).where(eq(reminders.id, testDeadReminderId));
    await db.delete(obligations).where(eq(obligations.id, testObligationId));
    await db.delete(businesses).where(eq(businesses.id, testBusinessId));
    await app.close();
  });

  it('1. GET /api/observability/metrics reports resource quotas with 70% thresholds', async () => {
    const res = await request(server)
      .get('/api/observability/metrics')
      .expect(200);

    expect(res.body).toHaveProperty('resend');
    expect(res.body.resend).toHaveProperty('usedToday');
    expect(res.body.resend.dailyCap).toBe(90);
    expect(res.body.resend).toHaveProperty('percentUsed');
    expect(['healthy', 'warning', 'critical']).toContain(res.body.resend.status);

    expect(res.body).toHaveProperty('database');
    expect(res.body.database.freeTierBytes).toBe(500 * 1024 * 1024);
    expect(res.body.database).toHaveProperty('formattedUsed');

    expect(res.body).toHaveProperty('storage');
    expect(res.body.storage.freeTierBytes).toBe(10 * 1024 * 1024 * 1024);
    expect(res.body.storage).toHaveProperty('formattedUsed');

    expect(res.body).toHaveProperty('systemAlerts');
    expect(Array.isArray(res.body.systemAlerts)).toBe(true);
  });

  it('2. POST /api/observability/usage-check runs daily check and detects alert status', async () => {
    const res = await request(server)
      .post('/api/observability/usage-check')
      .set('x-neon-function-trigger', 'true')
      .expect(201);

    expect(res.body).toHaveProperty('alertCount');
    expect(typeof res.body.alertCount).toBe('number');
    expect(res.body).toHaveProperty('metrics');
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it('3. GET /api/observability/unverified-rules returns candidate rules for two-person review', async () => {
    const res = await request(server)
      .get('/api/observability/unverified-rules')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const rule of res.body) {
      expect(rule.verified).toBe(false);
      expect(rule.sourceUrl).toBeDefined();
    }
  });

  it('4. GET /api/observability/dead-reminders returns dead letter queue items', async () => {
    const res = await request(server)
      .get('/api/observability/dead-reminders')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const target = res.body.find((r: any) => r.id === testDeadReminderId);
    expect(target).toBeDefined();
    expect(target.state).toBe('dead');
    expect(target.attempts).toBe(5);
    expect(target.businessName).toBe('Observability Test Corp');
  });

  it('5. POST /api/observability/dead-reminders/:id/retry requeues dead reminder to pending', async () => {
    const res = await request(server)
      .post(`/api/observability/dead-reminders/${testDeadReminderId}/retry`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(res.body.success).toBe(true);

    const [updated] = await db
      .select()
      .from(reminders)
      .where(eq(reminders.id, testDeadReminderId));

    expect(updated).toBeDefined();
    expect(updated!.state).toBe('pending');
    expect(updated!.attempts).toBe(0);
    expect(updated!.lastError).toBeNull();
  });

  it('6. GET /api/observability/failed-deliveries returns delivery failure diagnostics', async () => {
    const res = await request(server)
      .get('/api/observability/failed-deliveries')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const failureItem = res.body.find((f: any) => f.id === testDeliveryLogId);
    expect(failureItem).toBeDefined();
    expect(failureItem.result).toBe('failure');
    expect(failureItem.error).toContain('Simulated 500 upstream');
  });

  it('7. GET /api/observability/audit-trail returns statutory audit trail entries', async () => {
    const res = await request(server)
      .get('/api/observability/audit-trail')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(res.body).toHaveProperty('ruleAudits');
    expect(res.body).toHaveProperty('filingAudits');
    expect(Array.isArray(res.body.ruleAudits)).toBe(true);
    expect(res.body.ruleAudits.length).toBeGreaterThan(0);
  });
});
