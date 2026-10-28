import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

/**
 * Readiness probe for RabbitMQ: reads the connection state kept by RabbitMQService.
 */
@Injectable()
export class RabbitMQHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly rabbitService: RabbitMQService,
  ) {}

  async isHealthy(key = 'rabbitmq'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    return this.rabbitService.isConnected()
      ? indicator.up()
      : indicator.down({ message: 'not connected' });
  }
}
