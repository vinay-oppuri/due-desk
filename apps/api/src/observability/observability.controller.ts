import {
  Controller,
  Get,
  Post,
  Param,
  Headers,
  UseGuards,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ObservabilityService } from './observability.service.js';
import { SessionGuard } from '../auth/session.guard.js';
import { Roles, RolesGuard } from '../auth/roles.guard.js';

@Controller('api/observability')
export class ObservabilityController {
  private readonly logger = new Logger(ObservabilityController.name);

  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('metrics')
  async getMetrics() {
    return await this.observabilityService.getUsageMetrics();
  }

  @Post('usage-check')
  async runDailyUsageCheck(
    @Headers('x-neon-function-trigger') neonHeader?: string,
  ) {
    return await this.observabilityService.runDailyUsageCheck();
  }

  @Get('dead-reminders')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'accountant', 'ca')
  async getDeadReminders() {
    return await this.observabilityService.getDeadReminders();
  }

  @Post('dead-reminders/:id/retry')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'accountant', 'ca')
  async retryDeadReminder(@Param('id') id: string) {
    return await this.observabilityService.retryDeadReminder(id);
  }

  @Get('failed-deliveries')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'accountant', 'ca')
  async getFailedDeliveries() {
    return await this.observabilityService.getFailedDeliveries();
  }

  @Get('unverified-rules')
  async getUnverifiedRules() {
    return await this.observabilityService.getUnverifiedRules();
  }

  @Get('audit-trail')
  @UseGuards(SessionGuard, RolesGuard)
  @Roles('owner', 'accountant', 'ca')
  async getAuditTrail() {
    return await this.observabilityService.getAuditTrail();
  }
}
