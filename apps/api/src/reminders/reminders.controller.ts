import {
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard.js';
import { RemindersService } from './reminders.service.js';

@Controller('api/reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  /**
   * Hourly trigger endpoint invoked by Neon Function Trigger.
   * Scheduled calls arrive unauthenticated, so we validate the Neon trigger header
   * or a configured CRON_SECRET bearer token.
   * Never accepts recipients in request body (immune to parameter tampering).
   */
  @Post('scan')
  async triggerScan(
    @Headers('x-neon-function-trigger') neonHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    this.validateTriggerSecurity(neonHeader, authHeader);
    const result = await this.remindersService.scanAndDispatchReminders();
    return {
      status: 'success',
      ...result,
    };
  }

  /**
   * Daily watchdog endpoint invoked by Neon Function Trigger.
   * Repairs missing reminders for obligations due in the next 7 days.
   */
  @Post('watchdog')
  async triggerWatchdog(
    @Headers('x-neon-function-trigger') neonHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    this.validateTriggerSecurity(neonHeader, authHeader);
    const result = await this.remindersService.runWatchdog();
    return {
      status: 'success',
      ...result,
    };
  }

  /**
   * Returns scheduled reminders and status for the active organization.
   */
  @Get()
  @UseGuards(SessionGuard)
  async getReminders(
    @Req() req: Request,
    @Query('state') state?: string,
  ) {
    const orgId = (req as any).organizationId;
    const items = await this.remindersService.getReminders(orgId, state);
    return {
      organizationId: orgId,
      total: items.length,
      reminders: items,
    };
  }

  /**
   * Returns daily email budget usage and remaining quota.
   */
  @Get('budget')
  @UseGuards(SessionGuard)
  async getBudget() {
    const sentToday = await this.remindersService.getDailyEmailSendCount();
    return {
      limitPerDay: 100,
      safeCap: 90,
      alertThreshold: 70,
      sentToday,
      remainingSafeQuota: Math.max(0, 90 - sentToday),
    };
  }

  /**
   * Validates that the request is from a legitimate Neon Function Trigger
   * or has a valid CRON_SECRET authorization header.
   */
  private validateTriggerSecurity(neonHeader?: string, authHeader?: string) {
    const isDevOrTest =
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test' ||
      !process.env.NODE_ENV;

    const isNeonTrigger = neonHeader === 'true';
    const cronSecret = process.env.CRON_SECRET;
    const isSecretValid =
      cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isNeonTrigger && !isSecretValid && !isDevOrTest) {
      throw new UnauthorizedException(
        'Unauthorized: Scheduled calls require x-neon-function-trigger or valid CRON_SECRET.',
      );
    }
  }
}
