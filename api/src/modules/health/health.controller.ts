import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';
import { RabbitMQHealthIndicator } from './rabbitmq.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly rabbitmq: RabbitMQHealthIndicator,
  ) {}

  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'Service is healthy', schema: { example: { status: 'ok' } } })
  @Get()
  ping() {
    return { status: 'ok' };
  }

  @ApiOperation({ summary: 'Readiness check (Postgres, Redis, RabbitMQ)' })
  @ApiResponse({ status: 200, description: 'All dependencies are reachable' })
  @ApiResponse({ status: 503, description: 'At least one dependency is unreachable' })
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 2000 }),
      () => this.redis.isHealthy('redis'),
      () => this.rabbitmq.isHealthy('rabbitmq'),
    ]);
  }
}
