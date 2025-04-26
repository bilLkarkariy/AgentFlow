import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { trace, context as otContext, SpanKind, SpanStatusCode } from '@opentelemetry/api';

@Injectable()
export class AgentExecutionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AgentExecutionMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'POST' && req.path === '/run') {
      const tracer = trace.getTracer('agent-runtime');
      const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`, { kind: SpanKind.SERVER });
      otContext.with(trace.setSpan(otContext.active(), span), () => {});

      res.on('finish', () => {
        span.setAttribute('http.status_code', res.statusCode);
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      });
    }
    next();
  }
}
