import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { auth, getLatestOtpForTesting } from '@repo/auth/server';
import { db, businesses, memberships, organizations, eq } from '@repo/db';

describe('Phase 2: Auth, Multi-Tenancy & RBAC (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  const timestamp = Date.now();
  const userAEmail = `usera_${timestamp}@test.com`;
  const userBEmail = `userb_${timestamp}@test.com`;
  const viewerEmail = `viewer_${timestamp}@test.com`;

  let userASessionCookie: string;
  let userBSessionCookie: string;
  let viewerSessionCookie: string;

  let orgAId: string;
  let orgBId: string;

  let bizAId: string;
  let bizBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;

    // 1. Sign in User A via Email OTP
    await auth.api.sendVerificationOTP({
      body: { email: userAEmail, type: 'sign-in' },
    });
    const otpA = getLatestOtpForTesting(userAEmail);
    expect(otpA).toBeDefined();

    const resA = await auth.api.signInEmailOTP({
      body: { email: userAEmail, otp: otpA! },
      asResponse: true,
    });
    userASessionCookie = resA.headers.get('set-cookie') ?? '';
    const userAData = (await resA.json()) as { user: { id: string } };

    // Find Org A created by signup hook
    const [membershipA] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userAData.user.id));
    orgAId = membershipA!.organizationId;

    // 2. Sign in User B via Email OTP
    await auth.api.sendVerificationOTP({
      body: { email: userBEmail, type: 'sign-in' },
    });
    const otpB = getLatestOtpForTesting(userBEmail);
    expect(otpB).toBeDefined();

    const resB = await auth.api.signInEmailOTP({
      body: { email: userBEmail, otp: otpB! },
      asResponse: true,
    });
    userBSessionCookie = resB.headers.get('set-cookie') ?? '';
    const userBData = (await resB.json()) as { user: { id: string } };

    // Find Org B created by signup hook
    const [membershipB] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userBData.user.id));
    orgBId = membershipB!.organizationId;

    // 3. Create a viewer user in Org A via Email OTP
    await auth.api.sendVerificationOTP({
      body: { email: viewerEmail, type: 'sign-in' },
    });
    const otpViewer = getLatestOtpForTesting(viewerEmail);
    expect(otpViewer).toBeDefined();

    const resViewer = await auth.api.signInEmailOTP({
      body: { email: viewerEmail, otp: otpViewer! },
      asResponse: true,
    });
    viewerSessionCookie = resViewer.headers.get('set-cookie') ?? '';
    const viewerData = (await resViewer.json()) as { user: { id: string } };
    const viewerUserId = viewerData.user.id;

    // Add viewer to Org A with viewer role
    await db.insert(memberships).values({
      id: `mem_viewer_${timestamp}`,
      organizationId: orgAId,
      userId: viewerUserId,
      role: 'viewer',
    });
  });

  afterAll(async () => {
    // Cleanup created businesses and memberships
    if (bizAId || bizBId) {
      await db.delete(businesses).where(eq(businesses.organizationId, orgAId));
      await db.delete(businesses).where(eq(businesses.organizationId, orgBId));
    }
    await app.close();
  });

  it('1. User A and User B automatically have distinct organizations and owner memberships via OTP', async () => {
    expect(orgAId).toBeDefined();
    expect(orgBId).toBeDefined();
    expect(orgAId).not.toBe(orgBId);

    const [orgA] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgAId));
    const [orgB] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgBId));

    expect(orgA?.name).toContain('Organization');
    expect(orgB?.name).toContain('Organization');
  });

  it('2. Unauthenticated request to /api/businesses is rejected with 401 Unauthorized', async () => {
    await request(server).get('/api/businesses').expect(401);
  });

  it('3. User A can create a business in Org A and User B can create in Org B', async () => {
    const resA = await request(server)
      .post('/api/businesses')
      .set('Cookie', userASessionCookie)
      .send({ name: 'Alpha Logistics Pvt Ltd', state: 'KA' })
      .expect(201);

    bizAId = resA.body.id;
    expect(resA.body.organizationId).toBe(orgAId);
    expect(resA.body.name).toBe('Alpha Logistics Pvt Ltd');

    const resB = await request(server)
      .post('/api/businesses')
      .set('Cookie', userBSessionCookie)
      .send({ name: 'Beta Supermarket', state: 'MH' })
      .expect(201);

    bizBId = resB.body.id;
    expect(resB.body.organizationId).toBe(orgBId);
    expect(resB.body.name).toBe('Beta Supermarket');
  });

  it('4. User A only sees Org A businesses and CANNOT see Org B businesses', async () => {
    const res = await request(server)
      .get('/api/businesses')
      .set('Cookie', userASessionCookie)
      .expect(200);

    const list = res.body as Array<{
      id: string;
      organization_id: string;
      name: string;
    }>;
    expect(list.some((b) => b.id === bizAId)).toBe(true);
    expect(list.some((b) => b.id === bizBId)).toBe(false);
  });

  it('5. User B only sees Org B businesses and CANNOT see Org A businesses', async () => {
    const res = await request(server)
      .get('/api/businesses')
      .set('Cookie', userBSessionCookie)
      .expect(200);

    const list = res.body as Array<{
      id: string;
      organization_id: string;
      name: string;
    }>;
    expect(list.some((b) => b.id === bizBId)).toBe(true);
    expect(list.some((b) => b.id === bizAId)).toBe(false);
  });

  it('6. Cross-tenant spoofing: User A cannot access Org B by sending x-organization-id header', async () => {
    await request(server)
      .get('/api/businesses')
      .set('Cookie', userASessionCookie)
      .set('x-organization-id', orgBId)
      .expect(403);
  });

  it('7. RBAC: Viewer user cannot create businesses (rejected with 403 Forbidden)', async () => {
    await request(server)
      .post('/api/businesses')
      .set('Cookie', viewerSessionCookie)
      .set('x-organization-id', orgAId)
      .send({ name: 'Unauthorized Corp', state: 'DL' })
      .expect(403);
  });
});
