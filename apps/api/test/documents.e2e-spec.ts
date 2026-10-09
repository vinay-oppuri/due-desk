import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { auth, getLatestOtpForTesting } from '@repo/auth/server';
import {
  db,
  documents,
  memberships,
  organizations,
  subscriptions,
  user,
  eq,
} from '@repo/db';
import { randomUUID } from 'node:crypto';

describe('Phase 6: Document Vault & Private Storage (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  const timestamp = Date.now();
  const ownerAEmail = `doc_owner_a_${timestamp}@test.com`;
  const viewerAEmail = `doc_viewer_a_${timestamp}@test.com`;
  const ownerBEmail = `doc_owner_b_${timestamp}@test.com`;

  let ownerACookie: string;
  let viewerACookie: string;
  let ownerBCookie: string;

  let orgAId: string;
  let orgBId: string;

  let createdDocAId: string;
  let createdDocAR2Key: string;
  let retentionDocId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;

    // 1. Create Owner A and get Org A
    await auth.api.sendVerificationOTP({
      body: { email: ownerAEmail, type: 'sign-in' },
    });
    const otpA = getLatestOtpForTesting(ownerAEmail);
    const resA = await auth.api.signInEmailOTP({
      body: { email: ownerAEmail, otp: otpA! },
      asResponse: true,
    });
    ownerACookie = resA.headers.get('set-cookie') ?? '';
    const userAData = (await resA.json()) as { user: { id: string } };

    const [memA] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userAData.user.id));
    orgAId = memA!.organizationId;

    // 2. Create Viewer in Org A
    await auth.api.sendVerificationOTP({
      body: { email: viewerAEmail, type: 'sign-in' },
    });
    const otpViewer = getLatestOtpForTesting(viewerAEmail);
    const resViewer = await auth.api.signInEmailOTP({
      body: { email: viewerAEmail, otp: otpViewer! },
      asResponse: true,
    });
    viewerACookie = resViewer.headers.get('set-cookie') ?? '';
    const viewerData = (await resViewer.json()) as { user: { id: string } };

    // Update viewer membership to Org A with role 'viewer'
    await db
      .update(memberships)
      .set({ organizationId: orgAId, role: 'viewer' })
      .where(eq(memberships.userId, viewerData.user.id));

    // 3. Create Owner B and get Org B
    await auth.api.sendVerificationOTP({
      body: { email: ownerBEmail, type: 'sign-in' },
    });
    const otpB = getLatestOtpForTesting(ownerBEmail);
    const resB = await auth.api.signInEmailOTP({
      body: { email: ownerBEmail, otp: otpB! },
      asResponse: true,
    });
    ownerBCookie = resB.headers.get('set-cookie') ?? '';
    const userBData = (await resB.json()) as { user: { id: string } };

    const [memB] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userBData.user.id));
    orgBId = memB!.organizationId;

    // Provision standard subscription for testing orgs
    await db.insert(subscriptions).values([
      {
        id: `sub_${randomUUID().replace(/-/g, '')}`,
        organizationId: orgAId,
        plan: 'standard',
        status: 'active',
      },
      {
        id: `sub_${randomUUID().replace(/-/g, '')}`,
        organizationId: orgBId,
        plan: 'standard',
        status: 'active',
      },
    ]);
  });

  afterAll(async () => {
    if (orgAId) {
      await db.delete(documents).where(eq(documents.organizationId, orgAId));
      await db.delete(organizations).where(eq(organizations.id, orgAId));
    }
    if (orgBId) {
      await db.delete(documents).where(eq(documents.organizationId, orgBId));
      await db.delete(organizations).where(eq(organizations.id, orgBId));
    }
    await app.close();
  });

  it('1. POST /api/documents/upload-url authorizes and generates presigned PUT URL', async () => {
    const res = await request(server)
      .post('/api/documents/upload-url')
      .set('Cookie', ownerACookie)
      .send({
        fileName: 'gstr3b_challan_q1.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024 * 500, // 500 KB
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('documentId');
    expect(res.body).toHaveProperty('uploadUrl');
    expect(res.body).toHaveProperty('r2Key');
    expect(res.body.expiresIn).toBe(300);

    // Verify key layout includes organization ID to prevent cross-tenant guessing
    expect(res.body.r2Key.startsWith(`orgs/${orgAId}/documents/`)).toBe(true);

    createdDocAId = res.body.documentId;
    createdDocAR2Key = res.body.r2Key;
  });

  it('2. POST /api/documents/:id/confirm confirms upload and records metadata', async () => {
    const res = await request(server)
      .post(`/api/documents/${createdDocAId}/confirm`)
      .set('Cookie', ownerACookie)
      .send({
        r2Key: createdDocAR2Key,
        mimeType: 'application/pdf',
        fileSize: 1024 * 500,
        checksum: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(createdDocAId);
    expect(res.body.organizationId).toBe(orgAId);
    expect(res.body.r2Key).toBe(createdDocAR2Key);

    // Verify in database
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, createdDocAId));
    expect(doc).toBeDefined();
    expect(doc!.fileSize).toBe(1024 * 500);
  });

  it('3. GET /api/documents/:id/download-url generates presigned GET URL for authorized user', async () => {
    const res = await request(server)
      .get(`/api/documents/${createdDocAId}/download-url`)
      .set('Cookie', ownerACookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('downloadUrl');
    expect(res.body.expiresIn).toBe(900);
    expect(res.body.fileName).toContain('gstr3b_challan_q1.pdf');
    expect(res.body.mimeType).toBe('application/pdf');
  });

  it('4. Cross-tenant isolation: User B in Org B CANNOT download or delete Org A document', async () => {
    // User B tries to get download URL for Org A's document
    const downloadRes = await request(server)
      .get(`/api/documents/${createdDocAId}/download-url`)
      .set('Cookie', ownerBCookie);

    expect(downloadRes.status).toBe(404);

    // User B tries to delete Org A's document
    const deleteRes = await request(server)
      .delete(`/api/documents/${createdDocAId}`)
      .set('Cookie', ownerBCookie);

    expect(deleteRes.status).toBe(404);

    // User B tries to confirm an upload using Org A's r2Key
    const spoofConfirmRes = await request(server)
      .post(`/api/documents/${randomUUID()}/confirm`)
      .set('Cookie', ownerBCookie)
      .send({
        r2Key: `orgs/${orgAId}/documents/spoofed/file.pdf`,
        fileSize: 1000,
        mimeType: 'application/pdf',
      });

    expect(spoofConfirmRes.status).toBe(403);
  });

  it('5. RBAC enforcement: Viewer user CANNOT upload or delete documents', async () => {
    // Viewer tries to get upload URL
    const uploadRes = await request(server)
      .post('/api/documents/upload-url')
      .set('Cookie', viewerACookie)
      .send({
        fileName: 'unauthorized.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
      });

    expect(uploadRes.status).toBe(403);

    // Viewer tries to confirm upload
    const confirmRes = await request(server)
      .post(`/api/documents/${createdDocAId}/confirm`)
      .set('Cookie', viewerACookie)
      .send({
        r2Key: createdDocAR2Key,
        fileSize: 1000,
        mimeType: 'application/pdf',
      });

    expect(confirmRes.status).toBe(403);

    // Viewer tries to delete document
    const deleteRes = await request(server)
      .delete(`/api/documents/${createdDocAId}`)
      .set('Cookie', viewerACookie);

    expect(deleteRes.status).toBe(403);

    // Viewer CAN download documents (read-only access)
    const viewRes = await request(server)
      .get(`/api/documents/${createdDocAId}/download-url`)
      .set('Cookie', viewerACookie);

    expect(viewRes.status).toBe(200);
    expect(viewRes.body).toHaveProperty('downloadUrl');
  });

  it('6. Validation: Rejects invalid MIME types and oversized files', async () => {
    // Invalid MIME type (e.g. executable)
    const badMimeRes = await request(server)
      .post('/api/documents/upload-url')
      .set('Cookie', ownerACookie)
      .send({
        fileName: 'script.sh',
        mimeType: 'application/x-sh',
        fileSize: 1024,
      });

    expect(badMimeRes.status).toBe(400);
    expect(badMimeRes.body.message).toContain('Disallowed file type');

    // Oversized file (> 10MB)
    const oversizedRes = await request(server)
      .post('/api/documents/upload-url')
      .set('Cookie', ownerACookie)
      .send({
        fileName: 'huge.pdf',
        mimeType: 'application/pdf',
        fileSize: 15 * 1024 * 1024, // 15 MB
      });

    expect(oversizedRes.status).toBe(400);
    expect(oversizedRes.body.message).toContain('exceeds maximum allowed limit');
  });

  it('7. Storage quota: GET /api/documents/storage reports usage and enforces 100MB limit', async () => {
    const res = await request(server)
      .get('/api/documents/storage')
      .set('Cookie', ownerACookie);

    expect(res.status).toBe(200);
    expect(res.body.organizationId).toBe(orgAId);
    expect(res.body.limitBytes).toBe(100 * 1024 * 1024);
    expect(res.body.usedBytes).toBeGreaterThanOrEqual(1024 * 500);

    // Requesting upload that exceeds remaining quota is rejected
    const quotaExceedRes = await request(server)
      .post('/api/documents/upload-url')
      .set('Cookie', ownerACookie)
      .send({
        fileName: 'quota_breaker.pdf',
        mimeType: 'application/pdf',
        fileSize: 105 * 1024 * 1024, // > 100MB total limit
      });

    expect(quotaExceedRes.status).toBe(400);
  });

  it('8. Statutory retention lock: Blocks deletion if retain_until is in the future', async () => {
    // Create a document with retainUntil 8 years in the future (tax compliance requirement)
    retentionDocId = `doc_retain_${randomUUID().replace(/-/g, '')}`;
    const retentionKey = `orgs/${orgAId}/documents/${retentionDocId}/tax_audit.pdf`;

    await db.insert(documents).values({
      id: retentionDocId,
      organizationId: orgAId,
      r2Key: retentionKey,
      fileSize: 2048,
      mimeType: 'application/pdf',
      retainUntil: '2034-03-31',
    });

    // Attempt to delete: should be blocked
    const res = await request(server)
      .delete(`/api/documents/${retentionDocId}`)
      .set('Cookie', ownerACookie);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Cannot delete document under statutory retention period');

    // Document must still exist
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, retentionDocId));
    expect(doc).toBeDefined();
  });

  it('9. DELETE /api/documents/:id deletes document and updates storage', async () => {
    const res = await request(server)
      .delete(`/api/documents/${createdDocAId}`)
      .set('Cookie', ownerACookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deletedId).toBe(createdDocAId);

    // Verify removed from database
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, createdDocAId));
    expect(doc).toBeUndefined();
  });
});
