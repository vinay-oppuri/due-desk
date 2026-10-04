import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DrizzleModule } from './drizzle/index.js';

@Module({
  imports: [DrizzleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
