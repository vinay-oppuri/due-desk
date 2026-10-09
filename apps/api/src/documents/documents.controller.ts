import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard.js';
import { Roles, RolesGuard } from '../auth/roles.guard.js';
import {
  DocumentsService,
  type ConfirmUploadDto,
  type RequestUploadDto,
} from './documents.service.js';

@Controller('api/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * 1. Returns current storage quota metrics for the organization.
   */
  @Get('storage')
  @UseGuards(SessionGuard)
  async getStorage(@Req() req: AuthenticatedRequest) {
    return await this.documentsService.getStorageUsage(req.organizationId!);
  }

  /**
   * 2. Authorizes and generates a short-lived presigned PUT URL for direct R2 upload.
   * Viewers cannot upload.
   */
  @Post('upload-url')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'accountant', 'ca')
  async getUploadUrl(
    @Req() req: AuthenticatedRequest,
    @Body() body: RequestUploadDto,
  ) {
    return await this.documentsService.createUploadUrl(
      req.organizationId!,
      body,
    );
  }

  /**
   * 3. Confirms that direct client upload succeeded and creates the document row in Postgres.
   */
  @Post(':id/confirm')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'accountant', 'ca')
  async confirmUpload(
    @Req() req: AuthenticatedRequest,
    @Param('id') documentId: string,
    @Body() body: ConfirmUploadDto,
  ) {
    return await this.documentsService.confirmUpload(
      req.organizationId!,
      req.authSession!.user.id,
      documentId,
      body,
    );
  }

  /**
   * 4. Generates a short-lived presigned GET URL for securely downloading a document.
   * Scoped strictly by organization ID.
   */
  @Get(':id/download-url')
  @UseGuards(SessionGuard)
  async getDownloadUrl(
    @Req() req: AuthenticatedRequest,
    @Param('id') documentId: string,
  ) {
    return await this.documentsService.createDownloadUrl(
      req.organizationId!,
      documentId,
    );
  }

  /**
   * 5. Lists documents for the organization (optionally filtered by filing ID).
   */
  @Get()
  @UseGuards(SessionGuard)
  async listDocuments(
    @Req() req: AuthenticatedRequest,
    @Query('filingId') filingId?: string,
  ) {
    return await this.documentsService.listDocuments(
      req.organizationId!,
      filingId,
    );
  }

  /**
   * 6. Deletes a document from Postgres and Cloudflare R2.
   * Viewers cannot delete.
   * Blocks deletion if the statutory retention period (retain_until) is active.
   */
  @Delete(':id')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'accountant', 'ca')
  async deleteDocument(
    @Req() req: AuthenticatedRequest,
    @Param('id') documentId: string,
  ) {
    return await this.documentsService.deleteDocument(
      req.organizationId!,
      documentId,
    );
  }
}
