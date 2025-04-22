import { Controller, Get, Res } from '@nestjs/common';
import { register, collectDefaultMetrics } from 'prom-client';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

// Collect default metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics();

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({ status: 200, description: 'Metrics in Prometheus format' })
  @Get()
  async getMetrics(@Res() res: Response) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
