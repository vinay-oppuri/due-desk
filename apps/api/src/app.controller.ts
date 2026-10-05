import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { businesses, withTenantHttp } from '@repo/db';
import { AppService } from './app.service.js';
import {
  SessionGuard,
  type AuthenticatedRequest,
} from './auth/session.guard.js';
import { Roles, RolesGuard } from './auth/roles.guard.js';
import { DRIZZLE, type DrizzleDB } from './drizzle/index.js';

@Controller('api')
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  @Get('health')
  async health() {
    let database = 'disconnected';
    try {
      await this.db.execute('SELECT 1');
      database = 'connected';
    } catch (error) {
      database = error instanceof Error ? error.message : 'error';
    }

    return {
      status: 'ok',
      service: 'api',
      database,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: AuthenticatedRequest) {
    return {
      user: request.authSession?.user,
      organizationId: request.organizationId,
      role: request.userRole,
    };
  }

  @Get('businesses')
  @UseGuards(SessionGuard)
  async getBusinesses(@Req() request: AuthenticatedRequest) {
    const orgId = request.organizationId!;
    // Query businesses with strict Postgres RLS isolation
    const rows = await withTenantHttp(
      { organizationId: orgId, userId: request.authSession?.user?.id },
      'SELECT id, organization_id, name, state, business_type, turnover_bracket FROM businesses',
    );
    return rows;
  }

  @Post('businesses')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'accountant')
  async createBusiness(
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      name: string;
      state: string;
      businessType?: string;
      turnoverBracket?: string;
    },
  ) {
    const orgId = request.organizationId!;
    const bizId = `biz_${randomUUID().replace(/-/g, '')}`;

    await this.db.insert(businesses).values({
      id: bizId,
      organizationId: orgId,
      name: body.name,
      state: body.state,
      businessType: body.businessType || 'private_limited',
      turnoverBracket: body.turnoverBracket || 'under_20l',
    });

    return {
      id: bizId,
      organizationId: orgId,
      name: body.name,
      state: body.state,
    };
  }
}
