import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { DocumentsStorageService } from './services/documents-storage.service.js';
import { BillingModule } from '../billing/billing.module.js';

@Module({
  imports: [BillingModule],
  controllers: [DocumentsController],
  providers: [DocumentsStorageService, DocumentsService],
  exports: [DocumentsStorageService, DocumentsService],
})
export class DocumentsModule {}
