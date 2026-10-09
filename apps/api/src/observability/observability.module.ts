import { Module } from '@nestjs/common';
import { ObservabilityService } from './observability.service.js';
import { ObservabilityController } from './observability.controller.js';
import { ObservabilityMetricsService } from './services/observability-metrics.service.js';

@Module({
  controllers: [ObservabilityController],
  providers: [ObservabilityMetricsService, ObservabilityService],
  exports: [ObservabilityMetricsService, ObservabilityService],
})
export class ObservabilityModule {}
