import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@repo/env';

export type StorageClientOverride = {
  getSignedUrl: (command: any, options: any) => Promise<string>;
  deleteObject?: (key: string) => Promise<void>;
} | null;

let customStorageOverride: StorageClientOverride = null;

export function setStorageOverrideForTesting(override: StorageClientOverride) {
  customStorageOverride = override;
}

@Injectable()
export class DocumentsStorageService {
  private readonly logger = new Logger(DocumentsStorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucket: string | null = null;

  constructor() {
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
   * Generates a presigned PUT URL for client-side direct upload.
   */
  async getSignedUploadUrl(
    r2Key: string,
    mimeType: string,
    fileSize: number,
    expiresIn: number = 300,
  ): Promise<string> {
    if (customStorageOverride) {
      return customStorageOverride.getSignedUrl({ key: r2Key, action: 'put' }, { expiresIn });
    }

    if (this.s3Client && this.bucket) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: r2Key,
        ContentType: mimeType,
        ContentLength: fileSize,
      });
      return getSignedUrl(this.s3Client, command, { expiresIn });
    }

    // Mock signed URL for local development and test environments
    return `https://mock-r2.local/${r2Key}?action=put&expires=${Math.floor(Date.now() / 1000) + expiresIn}&sig=mock`;
  }

  /**
   * Generates a presigned GET URL for private document download.
   */
  async getSignedDownloadUrl(
    r2Key: string,
    expiresIn: number = 900,
  ): Promise<string> {
    if (customStorageOverride) {
      return customStorageOverride.getSignedUrl({ key: r2Key, action: 'get' }, { expiresIn });
    }

    if (this.s3Client && this.bucket) {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: r2Key,
      });
      return getSignedUrl(this.s3Client, command, { expiresIn });
    }

    // Mock signed URL for local development and test environments
    return `https://mock-r2.local/${r2Key}?action=get&expires=${Math.floor(Date.now() / 1000) + expiresIn}&sig=mock`;
  }

  /**
   * Deletes an object from the Cloudflare R2 bucket.
   */
  async deleteStorageObject(r2Key: string): Promise<void> {
    if (customStorageOverride?.deleteObject) {
      await customStorageOverride.deleteObject(r2Key);
      return;
    }

    if (this.s3Client && this.bucket) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: r2Key,
          }),
        );
      } catch (err: any) {
        this.logger.error(`Error deleting object ${r2Key} from R2: ${err.message}`);
      }
    }
  }
}
