import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { context as otContext, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { Histogram } from 'prom-client';

@Injectable()
export class OtelInterceptor implements NestInterceptor {
  // Prometheus histogram for HTTP server durations
  private static httpRequestDuration = new Histogram({
    name: 'http_server_duration_seconds',
    help: 'HTTP server request duration in seconds',
    labelNames: ['method', 'path', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5],
  });

  intercept(execContext: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = execContext.switchToHttp();
    const request = httpCtx.getRequest();
    const response = httpCtx.getResponse();
    const method = request.method;
    const path = request.url;
    const tracer = trace.getTracer('agent-runtime');
    const span = tracer.startSpan(`HTTP ${method} ${path}`, { kind: SpanKind.SERVER });
    const startTime = process.hrtime();

    return otContext.with(trace.setSpan(otContext.active(), span), () =>
      next.handle().pipe(
        tap({
          next: () => span.setStatus({ code: SpanStatusCode.OK }),
          error: (err) => span.setStatus({ code: SpanStatusCode.ERROR, message: err.message }),
        }),
        finalize(() => {
          const [sec, nanosec] = process.hrtime(startTime);
          const duration = sec + nanosec / 1e9;
          OtelInterceptor.httpRequestDuration
            .labels(method, path, String(response.statusCode))
            .observe(duration);
          span.end();
        }),
      ),
    );
  }
}
