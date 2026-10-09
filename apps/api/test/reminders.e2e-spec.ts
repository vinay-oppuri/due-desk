import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { auth, getLatestOtpForTesting } from '@repo/auth/server';
import { setReminderSendHandlerForTesting } from '@repo/auth/email';
import {
  db,
  businesses,
  deliveryLog,
  eq,
  memberships,
  obligations,
  reminders,
} from '@repo/db';
import { randomUUID } from 'node:crypto';

describe('Phase 5: Reminder Pipeline & Outbox Engine (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  const timestamp = Date.now();
  const ownerEmail = `reminder_owner_${timestamp}@test.com`;

  let sessionCookie: string;
  let orgId: string;
  let createdBizId: string;
  let testObligationId: string;
  let testReminderId: string;

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

    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userData.user.id));
    orgId = membership!.organizationId;

    // Clear any stale pending reminders from previous runs to ensure clean scanner queue
    await db
      .update(reminders)
      .set({ state: 'sent' })
      .where(eq(reminders.state, 'pending'));
  });

  afterAll(async () => {
    // Reset test email handler
    setReminderSendHandlerForTesting(null);

    // Fast cleanup of created records
    if (orgId) {
      await db.delete(reminders).where(eq(reminders.organizationId, orgId));
      await db.delete(obligations).where(eq(obligations.organizationId, orgId));
      await db.delete(businesses).where(eq(businesses.organizationId, orgId));
    }
    await app.close();
  });

  it('1. POST /api/businesses creates obligations AND schedules reminders (7, 3, 1 offsets)', async () => {
    const res = await request(server)
      .post('/api/businesses')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Omni Retail Pvt Ltd',
        state: 'KA',
        businessType: 'pvt_ltd',
        turnoverBracket: '1.5Cr-5Cr',
        hasEmployees: true,
        registrations: { gst: true, pf: true },
      });

    expect(res.status).toBe(201);
    createdBizId = res.body.id;

    // Check obligations were created
    const obList = await db
      .select()
      .from(obligations)
      .where(eq(obligations.organizationId, orgId));
    expect(obList.length).toBeGreaterThan(0);
    testObligationId = obList[0]!.id;

    // Check reminders were automatically scheduled
    const remList = await db
      .select()
      .from(reminders)
      .where(eq(reminders.obligationId, testObligationId));

    expect(remList.length).toBe(3); // 7, 3, and 1 day offsets
    const offsets = remList.map((r) => r.offsetDays).sort((a, b) => a - b);
    expect(offsets).toEqual([1, 3, 7]);
    expect(remList.every((r) => r.channel === 'email')).toBe(true);
    expect(remList.every((r) => r.state === 'pending')).toBe(true);
  });

  it('2. Duplicate scan runs send only once (idempotent outbox & FOR UPDATE SKIP LOCKED)', async () => {
    // Clear pending reminders from test 1 to isolate this test
    await db
      .update(reminders)
      .set({ state: 'sent' })
      .where(eq(reminders.state, 'pending'));

    // Setup a reminder with send_at in the past so it is picked up by the scanner
    testReminderId = `rem_test_${randomUUID().replace(/-/g, '')}`;
    await db.insert(reminders).values({
      id: testReminderId,
      organizationId: orgId,
      obligationId: testObligationId,
      channel: 'email',
      offsetDays: 10,
      sendAt: new Date(1000), // earliest epoch for queue priority
      state: 'pending',
      attempts: 0,
    });

    // Run Scan #1
    const res1 = await request(server)
      .post('/api/reminders/scan')
      .set('x-neon-function-trigger', 'true');

    expect(res1.status).toBe(201);
    expect(res1.body.status).toBe('success');
    expect(res1.body.sent).toBeGreaterThanOrEqual(1);

    // Verify reminder state transitioned to 'sent'
    const [updated1] = await db
      .select()
      .from(reminders)
      .where(eq(reminders.id, testReminderId));
    expect(updated1!.state).toBe('sent');

    // Verify deliveryLog entry exists
    const logs1 = await db
      .select()
      .from(deliveryLog)
      .where(eq(deliveryLog.reminderId, testReminderId));
    expect(logs1.length).toBe(1);
    expect(logs1[0]!.result).toBe('success');

    // Run Scan #2 immediately
    const res2 = await request(server)
      .post('/api/reminders/scan')
      .set('x-neon-function-trigger', 'true');

    expect(res2.status).toBe(201);

    // Verify reminder was NOT sent again
    const logs2 = await db
      .select()
      .from(deliveryLog)
      .where(eq(deliveryLog.reminderId, testReminderId));
    expect(logs2.length).toBe(1); // Still exactly 1 log entry
  });

  it('3. Filed obligations are skipped and marked done without dispatching email', async () => {
    // Clear pending queue to isolate test 3
    await db
      .update(reminders)
      .set({ state: 'sent' })
      .where(eq(reminders.state, 'pending'));

    // 1. Mark obligation as filed
    await request(server)
      .post(`/api/obligations/${testObligationId}/file`)
      .set('Cookie', sessionCookie)
      .send({ notes: 'Filing completed early' });

    // 2. Insert a pending reminder for this filed obligation
    const filedReminderId = `rem_filed_${randomUUID().replace(/-/g, '')}`;
    await db.insert(reminders).values({
      id: filedReminderId,
      organizationId: orgId,
      obligationId: testObligationId,
      channel: 'email',
      offsetDays: 14,
      sendAt: new Date(1000),
      state: 'pending',
      attempts: 0,
    });

    // 3. Run scan
    const res = await request(server)
      .post('/api/reminders/scan')
      .set('x-neon-function-trigger', 'true');

    expect(res.status).toBe(201);
    expect(res.body.skippedFiled).toBeGreaterThanOrEqual(1);

    // Verify reminder was marked 'sent' (done) and providerId recorded as 'skipped_filed'
    const [rem] = await db
      .select()
      .from(reminders)
      .where(eq(reminders.id, filedReminderId));
    expect(rem!.state).toBe('sent');

    const [log] = await db
      .select()
      .from(deliveryLog)
      .where(eq(deliveryLog.reminderId, filedReminderId));
    expect(log!.result).toBe('success');
    expect(log!.providerId).toBe('skipped_filed');

    await db.delete(deliveryLog).where(eq(deliveryLog.reminderId, filedReminderId));
    await db.delete(reminders).where(eq(reminders.id, filedReminderId));
  });

  it('4. Failure retry with exponential backoff and transition to dead state after 5 attempts', async () => {
    // Clear pending queue to isolate test 4
    await db
      .update(reminders)
      .set({ state: 'sent' })
      .where(eq(reminders.state, 'pending'));

    // Create a new pending obligation with early due date
    const failObId = `ob_fail_${randomUUID().replace(/-/g, '')}`;
    await db.insert(obligations).values({
      id: failObId,
      organizationId: orgId,
      businessId: createdBizId,
      ruleId: 'rule_gst_gstr3b_monthly',
      ruleVersion: 1,
      periodLabel: 'March 2027',
      dueDate: '2025-01-01',
      status: 'pending',
    });

    const failReminderId = `rem_fail_${randomUUID().replace(/-/g, '')}`;
    await db.insert(reminders).values({
      id: failReminderId,
      organizationId: orgId,
      obligationId: failObId,
      channel: 'email',
      offsetDays: 5,
      sendAt: new Date(0), // earliest epoch
      state: 'pending',
      attempts: 0,
    });

    // Configure test handler to simulate provider failure
    setReminderSendHandlerForTesting(async () => {
      return { success: false, error: 'SMTP Timeout: 504 Gateway error' };
    });

    // Attempt 1: Run scan
    const res1 = await request(server)
      .post('/api/reminders/scan')
      .set('x-neon-function-trigger', 'true');
    expect(res1.status).toBe(201);

    const [rem1] = await db
      .select()
      .from(reminders)
      .where(eq(reminders.id, failReminderId));
    expect(rem1!.state).toBe('failed');
    expect(rem1!.attempts).toBe(1);
    expect(new Date(rem1!.sendAt).getTime()).toBeGreaterThan(Date.now()); // Exponential backoff in future

    // Fast-forward to attempt 4 and due now
    await db
      .update(reminders)
      .set({
        attempts: 4,
        state: 'pending',
        sendAt: new Date(0),
      })
      .where(eq(reminders.id, failReminderId));

    // Attempt 5: Run scan -> should move to dead state
    const res5 = await request(server)
      .post('/api/reminders/scan')
      .set('x-neon-function-trigger', 'true');
    expect(res5.status).toBe(201);

    const [rem5] = await db
      .select()
      .from(reminders)
      .where(eq(reminders.id, failReminderId));
    expect(rem5!.state).toBe('dead');
    expect(rem5!.attempts).toBe(5);
    expect(rem5!.lastError).toContain('SMTP Timeout');

    // Restore test handler
    setReminderSendHandlerForTesting(null);

    // Cleanup
    await db.delete(deliveryLog).where(eq(deliveryLog.reminderId, failReminderId));
    await db.delete(reminders).where(eq(reminders.id, failReminderId));
    await db.delete(obligations).where(eq(obligations.id, failObId));
  });

  it('5. Daily Watchdog checks obligations due in next 7 days and repairs missing reminders', async () => {
    // 1. Create an obligation due in 4 days
    const upcomingDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const watchObId = `ob_watch_${randomUUID().replace(/-/g, '')}`;
    await db.insert(obligations).values({
      id: watchObId,
      organizationId: orgId,
      businessId: createdBizId,
      ruleId: 'rule_gst_gstr1_monthly',
      ruleVersion: 1,
      periodLabel: 'Immediate Due',
      dueDate: upcomingDate!,
      status: 'pending',
    });

    // Deliberately do NOT create any reminders (or delete them)
    const existing = await db
      .select()
      .from(reminders)
      .where(eq(reminders.obligationId, watchObId));
    expect(existing.length).toBe(0);

    // 2. Run Watchdog
    const res = await request(server)
      .post('/api/reminders/watchdog')
      .set('x-neon-function-trigger', 'true');

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.repairedCount).toBeGreaterThanOrEqual(3);

    // 3. Verify reminders were restored for all 3 offsets (7, 3, 1)
    const restored = await db
      .select()
      .from(reminders)
      .where(eq(reminders.obligationId, watchObId));
    expect(restored.length).toBe(3);

    // Cleanup
    await db.delete(reminders).where(eq(reminders.obligationId, watchObId));
    await db.delete(obligations).where(eq(obligations.id, watchObId));
  });

  it('6. GET /api/reminders/budget returns daily send metrics and safe limits', async () => {
    const res = await request(server)
      .get('/api/reminders/budget')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.limitPerDay).toBe(100);
    expect(res.body.safeCap).toBe(90);
    expect(res.body.alertThreshold).toBe(70);
    expect(typeof res.body.sentToday).toBe('number');
    expect(typeof res.body.remainingSafeQuota).toBe('number');
  });

  it('7. GET /api/reminders returns scheduled reminders scoped to organization', async () => {
    const res = await request(server)
      .get('/api/reminders')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.organizationId).toBe(orgId);
    expect(Array.isArray(res.body.reminders)).toBe(true);
    expect(res.body.reminders.length).toBeGreaterThan(0);
    expect(res.body.reminders[0]).toHaveProperty('formCode');
    expect(res.body.reminders[0]).toHaveProperty('dueDate');
    expect(res.body.reminders[0]).toHaveProperty('state');
  });
});
