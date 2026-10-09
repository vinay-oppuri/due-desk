import { Module } from '@nestjs/common';
import { ObservabilityService } from './observability.service.js';
import { ObservabilityController } from './observability.controller.js';

@Module({
  controllers: [ObservabilityController],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
