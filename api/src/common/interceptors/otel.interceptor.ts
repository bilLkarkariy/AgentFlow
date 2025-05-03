import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { context, trace } from '@opentelemetry/api';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class OtelInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const tracer = trace.getTracer('nestjs');
    const span = tracer.startSpan(`${req.method} ${req.url}`);
    return context.with(trace.setSpan(context.active(), span), () =>
      next.handle().pipe(
        tap({
          complete: () => span.end(),
          error: () => span.end(),
        }),
      ),
    );
  }
}
