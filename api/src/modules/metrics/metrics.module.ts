import { Global, Module, OnModuleInit } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { AgentMetricsService } from './agent-metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { ensureDefaultMetrics } from './prom-registry';

/**
 * Global: `AgentMetricsService` is injected from the runtime services
 * (python client) as well as from the queue plumbing, without every module
 * having to import this one.
 */
@Global()
@Module({
  imports: [PricingModule],
  controllers: [MetricsController],
  providers: [AgentMetricsService, MetricsService],
  exports: [AgentMetricsService, MetricsService],
})
export class MetricsModule implements OnModuleInit {
  onModuleInit(): void {
    ensureDefaultMetrics();
  }
}
