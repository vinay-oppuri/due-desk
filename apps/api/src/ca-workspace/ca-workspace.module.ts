import { Module } from '@nestjs/common';
import { CaWorkspaceController } from './ca-workspace.controller.js';
import { CaWorkspaceService } from './ca-workspace.service.js';
import { CaImportService } from './services/ca-import.service.js';
import { CaBoardService } from './services/ca-board.service.js';
import { CaDigestService } from './services/ca-digest.service.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { ComplianceModule } from '../compliance/compliance.module.js';

@Module({
  imports: [DrizzleModule, BillingModule, ComplianceModule],
  controllers: [CaWorkspaceController],
  providers: [
    CaImportService,
    CaBoardService,
    CaDigestService,
    CaWorkspaceService,
  ],
  exports: [
    CaImportService,
    CaBoardService,
    CaDigestService,
    CaWorkspaceService,
  ],
})
export class CaWorkspaceModule {}
