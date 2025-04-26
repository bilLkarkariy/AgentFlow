import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { AgentExecutionInterceptor } from './agent-execution.interceptor';
import { AgentExecutionMiddleware } from './agent-execution.middleware';

@Module({
  providers: [PricingService, AgentExecutionInterceptor, AgentExecutionMiddleware],
  exports: [PricingService, AgentExecutionInterceptor, AgentExecutionMiddleware],
})
export class TelemetryModule {}
