import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { AppService } from './app.service.js';
import { SessionGuard, type AuthenticatedRequest } from './auth/session.guard.js';
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
    return { user: request.authSession?.user };
  }
}
