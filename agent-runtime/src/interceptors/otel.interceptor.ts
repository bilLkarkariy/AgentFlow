import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { context as otContext, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';

@Injectable()
export class OtelInterceptor implements NestInterceptor {
  intercept(execContext: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = execContext.switchToHttp();
    const request = httpCtx.getRequest();
    const method = request.method;
    const path = request.url;
    const tracer = trace.getTracer('agent-runtime');
    const span = tracer.startSpan(`HTTP ${method} ${path}`, {
      kind: SpanKind.SERVER,
    });

    return otContext.with(trace.setSpan(otContext.active(), span), () =>
      next.handle().pipe(
        tap({
          next: () => span.setStatus({ code: SpanStatusCode.OK }),
          error: (err) => span.setStatus({ code: SpanStatusCode.ERROR, message: err.message }),
        }),
        finalize(() => span.end()),
      ),
    );
  }
}
