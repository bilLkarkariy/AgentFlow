import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { context, trace } from '@opentelemetry/api';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerKey = 'x-request-id';
  const requestId = (req.headers[headerKey] as string) || randomUUID();
  // Set the header on the response
  res.setHeader(headerKey, requestId);
  // Attach to request object
  (req as any).requestId = requestId;
  // Propagate to OpenTelemetry span
  const span = trace.getSpan(context.active());
  if (span) {
    span.setAttribute('http.request_id', requestId);
  }
  next();
}
