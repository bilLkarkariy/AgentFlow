import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import Redis from 'ioredis';

const REDIS_TIMEOUT_MS = 2000;

/**
 * Readiness probe for Redis: opens a short-lived connection and pings it.
 * A dedicated client keeps the probe independent from the BullMQ pool.
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: REDIS_TIMEOUT_MS,
      commandTimeout: REDIS_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    // ioredis emits `error` on an unreachable server; swallow it, the ping below reports it
    client.on('error', () => undefined);

    try {
      await withTimeout(
        client.connect().then(() => client.ping()),
        REDIS_TIMEOUT_MS,
      );
      return indicator.up();
    } catch (err) {
      return indicator.down({ message: err instanceof Error ? err.message : 'redis ping failed' });
    } finally {
      client.disconnect();
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}
