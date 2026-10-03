import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AppService } from './app.service.js';
import { SessionGuard, type AuthenticatedRequest } from './auth/session.guard.js';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.authSession?.user };
  }
}
