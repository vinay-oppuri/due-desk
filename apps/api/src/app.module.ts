import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DrizzleModule } from './drizzle/index.js';
import { ComplianceModule } from './compliance/compliance.module.js';
import { RemindersModule } from './reminders/reminders.module.js';

@Module({
  imports: [DrizzleModule, ComplianceModule, RemindersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
