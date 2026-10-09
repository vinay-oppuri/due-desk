import { Module } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { BillingController } from './billing.controller.js';
import { BillingWebhookService } from './services/billing-webhook.service.js';

@Module({
  controllers: [BillingController],
  providers: [BillingWebhookService, BillingService],
  exports: [BillingWebhookService, BillingService],
})
export class BillingModule {}
