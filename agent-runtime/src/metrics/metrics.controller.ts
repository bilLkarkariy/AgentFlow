import { Controller, Get, Header } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';
import { OtelInterceptor } from '../interceptors/otel.interceptor';

@Controller('metrics')
export class MetricsController {
  constructor() {
    // Collect default Node.js and system metrics
    collectDefaultMetrics();
    // Register HTTP duration histogram from interceptor
    register.registerMetric((OtelInterceptor as any).httpRequestDuration);
  }

  @Get()
  @Header('Content-Type', 'text/plain')
  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
