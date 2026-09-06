import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { loggerParams } from './logger.config';

/**
 * Structured JSON logging (nestjs-pino).
 *
 * Every line carries `level` as a label, an ISO timestamp, `service: "api"`
 * and, when a span is active, `trace_id` / `span_id` so Grafana can jump from
 * a Loki line to the Tempo trace. `LOG_PRETTY=true` switches to a human
 * readable stream for local development.
 */
@Module({
  imports: [PinoLoggerModule.forRoot(loggerParams)],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
