import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../auth/session.guard.js';
import { Roles, RolesGuard } from '../auth/roles.guard.js';
import {
  ComplianceService,
  type CreateBusinessDto,
  type MarkFiledDto,
} from './compliance.service.js';

@Controller('api')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  /**
   * 1. Onboarding: creates a business and automatically seeds its compliance obligations.
   */
  @Post('businesses')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'accountant')
  async createBusiness(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateBusinessDto,
  ) {
    const orgId = request.organizationId!;
    return this.complianceService.createBusiness(orgId, body);
  }

  /**
   * 2. List all obligations for calendar and dashboard with optional filters.
   */
  @Get('obligations')
  @UseGuards(SessionGuard)
  async getObligations(
    @Req() request: AuthenticatedRequest,
    @Query('businessId') businessId?: string,
    @Query('month') month?: string,
    @Query('upcomingDays') upcomingDays?: string,
    @Query('status') status?: string,
  ) {
    const orgId = request.organizationId!;
    return this.complianceService.getObligations(orgId, {
      businessId,
      month,
      upcomingDays: upcomingDays ? parseInt(upcomingDays, 10) : undefined,
      status,
    });
  }

  /**
   * 3. Filing Detail: checklist of documents, portal link, and filing history.
   */
  @Get('obligations/:id')
  @UseGuards(SessionGuard)
  async getObligationDetail(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const orgId = request.organizationId!;
    return this.complianceService.getObligationDetail(orgId, id);
  }

  /**
   * 4. Mark Obligation as Filed (appends to filings log).
   */
  @Post('obligations/:id/file')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'accountant', 'ca')
  async markAsFiled(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: MarkFiledDto,
  ) {
    const orgId = request.organizationId!;
    const userId = request.authSession?.user?.id || 'system';
    return this.complianceService.markAsFiled(orgId, userId, id, body);
  }

  /**
   * 5. Calendar feed in standard iCalendar (.ics) format.
   */
  @Get('calendar/feed.ics')
  @UseGuards(SessionGuard)
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="duedesk-calendar.ics"')
  async getCalendarFeed(
    @Req() request: AuthenticatedRequest,
    @Query('businessId') businessId?: string,
  ) {
    const orgId = request.organizationId!;
    return this.complianceService.generateIcsFeed(orgId, businessId);
  }
}
