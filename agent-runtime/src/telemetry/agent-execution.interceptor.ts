import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { trace, context as otContext, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { PricingService } from './pricing.service';
import { Provider } from './providers.enum';
import { Counter } from 'prom-client';

@Injectable()
export class AgentExecutionInterceptor implements NestInterceptor {
  constructor(private readonly pricingService: PricingService) {}

  // Prometheus counters for token usage and cost
  private static promptTokensCounter = new Counter({ name: 'prompt_tokens_total', help: 'Total number of prompt tokens processed' });
  private static completionTokensCounter = new Counter({ name: 'completion_tokens_total', help: 'Total number of completion tokens processed' });
  private static priceUsdCounter = new Counter({ name: 'price_usd_total', help: 'Total cost in USD of tokens processed' });

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest();

    // skip metrics endpoint to avoid intercepting Prometheus requests
    if (req.method === 'GET' && req.path === '/metrics') {
      return next.handle();
    }

    const modelName = req.body?.parameters?.model;
    const tracer = trace.getTracer('agent-runtime');
    const span = tracer.startSpan('AgentExecutionSpan', { kind: SpanKind.SERVER });

    return otContext.with(trace.setSpan(otContext.active(), span), () =>
      next.handle().pipe(
        tap((response: any) => {
          const usage = response.usage;
          try {
            const provider = Provider.OpenAI;
            const rates = this.pricingService.getRates(provider, modelName || response.model);
            const promptCount = usage.prompt_tokens ?? 0;
            const completionCount = usage.completion_tokens ?? 0;
            const priceUsd = (promptCount * rates.prompt_rate + completionCount * rates.completion_rate) / 1000;
            // record Prometheus counters
            AgentExecutionInterceptor.promptTokensCounter.inc(promptCount);
            AgentExecutionInterceptor.completionTokensCounter.inc(completionCount);
            AgentExecutionInterceptor.priceUsdCounter.inc(priceUsd);
            // set OpenTelemetry span attributes
            span.setAttribute('prompt_tokens', promptCount);
            span.setAttribute('completion_tokens', completionCount);
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
