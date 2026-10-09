import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  and,
  desc,
  documents,
  eq,
  filings,
  sum,
} from '@repo/db';
import { env } from '@repo/env';
import { DRIZZLE, type DrizzleDB } from '../drizzle/index.js';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const FREE_TIER_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB per org

export interface RequestUploadDto {
  fileName: string;
  mimeType: string;
  fileSize: number;
  filingId?: string;
  retainUntil?: string;
}

export interface ConfirmUploadDto {
  r2Key: string;
  fileSize: number;
  mimeType: string;
  checksum?: string;
  filingId?: string;
  retainUntil?: string;
}

export type StorageClientOverride = {
  getSignedUrl: (command: any, options: any) => Promise<string>;
  deleteObject?: (key: string) => Promise<void>;
} | null;

let customStorageOverride: StorageClientOverride = null;

export function setStorageOverrideForTesting(override: StorageClientOverride) {
  customStorageOverride = override;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucket: string | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {
    const isConfigured =
      env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET &&
      !env.R2_ACCOUNT_ID.includes('your-');

    if (isConfigured) {
      this.bucket = env.R2_BUCKET!;
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID!,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
        },
      });
      this.logger.log(`Initialized S3 Client for Cloudflare R2 bucket: ${this.bucket}`);
    } else {
      this.logger.log('R2 credentials not provided. Operating in mock/test storage mode.');
    }
  }

  /**
   * Calculates current storage usage for an organization.
   */
  async getStorageUsage(orgId: string) {
    const res = await this.db
      .select({ total: sum(documents.fileSize) })
      .from(documents)
      .where(eq(documents.organizationId, orgId));

    const usedBytes = Number(res[0]?.total || 0);
    const limitBytes = FREE_TIER_STORAGE_LIMIT_BYTES;
    const percentUsed = Math.min(100, Math.round((usedBytes / limitBytes) * 100));

    return {
      organizationId: orgId,
      usedBytes,
      limitBytes,
      percentUsed,
      remainingBytes: Math.max(0, limitBytes - usedBytes),
    };
  }

  /**
   * Generates a short-lived presigned PUT URL for direct client upload to Cloudflare R2.
   * Validates MIME type, file size limit (10MB), and tenant quota (100MB).
   */
  async createUploadUrl(
    orgId: string,
    dto: RequestUploadDto,
  ) {
    // 1. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(dto.mimeType)) {
      throw new BadRequestException(
        `Disallowed file type: ${dto.mimeType}. Allowed formats: PDF, PNG, JPEG.`,
      );
    }

    // 2. Validate max file size
    if (dto.fileSize <= 0 || dto.fileSize > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File size exceeds maximum allowed limit of 10 MB (${dto.fileSize} bytes provided).`,
      );
    }

    // 3. Validate organization storage quota
    const usage = await this.getStorageUsage(orgId);
    if (usage.usedBytes + dto.fileSize > usage.limitBytes) {
      throw new BadRequestException(
        `Storage quota exceeded. Allowed: 100 MB, Used: ${Math.round(usage.usedBytes / 1024 / 1024)} MB.`,
      );
    }

    // 4. Validate filingId if provided
    if (dto.filingId) {
      const [filing] = await this.db
        .select()
        .from(filings)
        .where(
          and(
            eq(filings.id, dto.filingId),
            eq(filings.organizationId, orgId),
          ),
        );
      if (!filing) {
        throw new NotFoundException(`Filing ${dto.filingId} not found in current organization`);
      }
    }

    const documentId = `doc_${randomUUID().replace(/-/g, '')}`;
    const cleanFileName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = `orgs/${orgId}/documents/${documentId}/${cleanFileName}`;
    const expiresIn = 300; // 5 minutes

    let uploadUrl: string;

    if (customStorageOverride) {
      uploadUrl = await customStorageOverride.getSignedUrl({ key: r2Key, action: 'put' }, { expiresIn });
    } else if (this.s3Client && this.bucket) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: r2Key,
        ContentType: dto.mimeType,
        ContentLength: dto.fileSize,
      });
      uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
    } else {
      // Mock signed URL for development and testing
      uploadUrl = `https://mock-r2.local/${r2Key}?action=put&expires=${Math.floor(Date.now() / 1000) + expiresIn}&sig=mock`;
    }

    return {
      documentId,
      r2Key,
      uploadUrl,
      expiresIn,
      mimeType: dto.mimeType,
      maxSizeBytes: dto.fileSize,
    };
  }

  /**
   * Confirms a completed upload and records document metadata in Postgres.
   */
  async confirmUpload(
    orgId: string,
    userId: string,
    documentId: string,
    dto: ConfirmUploadDto,
  ) {
    // Prevent cross-tenant key injection: r2Key must be scoped to the organization
    if (!dto.r2Key.startsWith(`orgs/${orgId}/`)) {
      throw new ForbiddenException('Invalid storage key: does not belong to organization.');
    }

    // Validate filing association if provided
    if (dto.filingId) {
      const [filing] = await this.db
        .select()
        .from(filings)
        .where(
          and(
            eq(filings.id, dto.filingId),
            eq(filings.organizationId, orgId),
          ),
        );
      if (!filing) {
        throw new NotFoundException(`Filing ${dto.filingId} not found in this organization`);
      }
    }

    const newDoc = {
      id: documentId,
      organizationId: orgId,
      filingId: dto.filingId || null,
      r2Key: dto.r2Key,
      checksum: dto.checksum || null,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
      uploadedBy: userId,
      retainUntil: dto.retainUntil || null,
    };

    await this.db.insert(documents).values(newDoc);

    return newDoc;
  }

  /**
   * Generates a short-lived presigned GET URL for downloading a private document.
   * Enforces tenant isolation.
   */
  async createDownloadUrl(orgId: string, documentId: string) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, orgId),
        ),
      );

    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found in this organization.`);
    }

    const expiresIn = 900; // 15 minutes
    let downloadUrl: string;

    if (customStorageOverride) {
      downloadUrl = await customStorageOverride.getSignedUrl({ key: doc.r2Key, action: 'get' }, { expiresIn });
    } else if (this.s3Client && this.bucket) {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: doc.r2Key,
      });
      downloadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
    } else {
      downloadUrl = `https://mock-r2.local/${doc.r2Key}?action=get&expires=${Math.floor(Date.now() / 1000) + expiresIn}&sig=mock`;
    }

    return {
      documentId: doc.id,
      fileName: doc.r2Key.split('/').pop() || 'document',
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      downloadUrl,
      expiresIn,
      retainUntil: doc.retainUntil,
    };
  }

  /**
   * Lists documents for an organization with optional filing filter.
   */
  async listDocuments(orgId: string, filingId?: string) {
    let query = this.db
      .select()
      .from(documents)
      .where(
        filingId
          ? and(
              eq(documents.organizationId, orgId),
              eq(documents.filingId, filingId),
            )
          : eq(documents.organizationId, orgId),
      )
      .orderBy(desc(documents.createdAt));

    const items = await query;
    const usage = await this.getStorageUsage(orgId);

    return {
      organizationId: orgId,
      total: items.length,
      documents: items,
      storage: usage,
    };
  }

  /**
   * Deletes a document from Postgres and Cloudflare R2.
   * Protects documents under statutory retention (retain_until).
   */
  async deleteDocument(orgId: string, documentId: string) {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, orgId),
        ),
      );

    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found in this organization.`);
    }

    // Check statutory retention lock
    if (doc.retainUntil) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (doc.retainUntil > todayStr!) {
        throw new BadRequestException(
          `Cannot delete document under statutory retention period until ${doc.retainUntil}.`,
        );
      }
    }

    // Delete object from R2 bucket
    if (customStorageOverride?.deleteObject) {
      await customStorageOverride.deleteObject(doc.r2Key);
    } else if (this.s3Client && this.bucket) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: doc.r2Key,
          }),
        );
      } catch (err: any) {
        this.logger.error(`Error deleting object ${doc.r2Key} from R2: ${err.message}`);
      }
    }

    // Delete row from database
    await this.db
      .delete(documents)
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, orgId),
        ),
      );

    return {
      success: true,
      deletedId: documentId,
    };
  }
}
