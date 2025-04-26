import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { trace, context as otContext, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { PricingService } from './pricing.service';
import { Provider } from './providers.enum';

@Injectable()
export class AgentExecutionInterceptor implements NestInterceptor {
  constructor(private readonly pricingService: PricingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest();
    const modelName = req.body.parameters?.model;
    const tracer = trace.getTracer('agent-runtime');
    const span = tracer.startSpan('AgentExecutionSpan', { kind: SpanKind.SERVER });

    return otContext.with(trace.setSpan(otContext.active(), span), () =>
      next.handle().pipe(
        tap((response: any) => {
          const usage = response.usage;
          try {
            const provider = Provider.OpenAI; // modify if dynamic provider
            const rates = this.pricingService.getRates(provider, modelName || response.model);
            const priceUsd = (usage.prompt_tokens * rates.prompt_rate + usage.completion_tokens * rates.completion_rate) / 1000;
            span.setAttribute('prompt_tokens', usage.prompt_tokens);
            span.setAttribute('completion_tokens', usage.completion_tokens);
            span.setAttribute('price_usd', priceUsd);
            span.setStatus({ code: SpanStatusCode.OK });
          } catch (err: any) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          }
        }),
        finalize(() => span.end()),
      ),
    );
  }
}
