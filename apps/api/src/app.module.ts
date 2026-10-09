import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DrizzleModule } from './drizzle/index.js';
import { ComplianceModule } from './compliance/compliance.module.js';
import { RemindersModule } from './reminders/reminders.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { BillingModule } from './billing/billing.module.js';
import { CaWorkspaceModule } from './ca-workspace/ca-workspace.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: process.env.NODE_ENV === 'test' ? 2000 : 100,
      },
    ]),
    DrizzleModule,
    ComplianceModule,
    RemindersModule,
    DocumentsModule,
    ObservabilityModule,
    BillingModule,
    CaWorkspaceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
