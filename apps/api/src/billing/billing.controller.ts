import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Req,
  UseGuards,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { BillingService, type CheckoutSessionDto } from './billing.service.js';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard.js';
import { Roles, RolesGuard } from '../auth/roles.guard.js';

@Controller('api/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('subscription')
  @UseGuards(SessionGuard)
  async getSubscription(@Req() req: AuthenticatedRequest) {
    return await this.billingService.getSubscription(req.organizationId!);
  }

  @Post('checkout')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner')
  async createCheckoutSession(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CheckoutSessionDto,
  ) {
    return await this.billingService.createCheckoutSession(req.organizationId!, dto);
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: any,
  ) {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    return await this.billingService.handleWebhook(signature, body, rawBody);
  }

  @Get('invoices')
  @UseGuards(SessionGuard)
  async getInvoices(@Req() req: AuthenticatedRequest) {
    return await this.billingService.getInvoices(req.organizationId!);
  }

  @Post('test-upgrade')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner')
  async testUpgrade(
    @Req() req: AuthenticatedRequest,
    @Body('plan') plan: 'free' | 'standard' | 'pro',
  ) {
    if (!['free', 'standard', 'pro'].includes(plan)) {
      throw new BadRequestException('Plan must be free, standard, or pro');
    }
    return await this.billingService.testUpgradePlan(req.organizationId!, plan);
  }
}
