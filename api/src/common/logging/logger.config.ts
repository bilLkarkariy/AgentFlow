import { context, isSpanContextValid, trace } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';
import type { Options } from 'pino-http';
import pino, { DestinationStream } from 'pino';

/** Probe and scrape endpoints: never logged, they would drown everything else. */
const IGNORED_PATHS = /^\/(health|metrics)/;

interface TraceFields {
  trace_id?: string;
  span_id?: string;
}

/** Correlate a log line with the OTel span that is active when it is written. */
function currentTraceFields(): TraceFields {
  const spanContext = trace.getSpan(context.active())?.spanContext();
  if (!spanContext || !isSpanContextValid(spanContext)) return {};
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
}

/**
 * Local development only: pino-pretty is a devDependency, required lazily so a
 * production image that does not ship it still boots. It is wired as a plain
 * destination stream rather than as a pino `transport`: no worker thread, and
 * nothing left buffered off-thread when the process shuts down.
 */
function prettyStream(): DestinationStream | undefined {
  if (process.env.LOG_PRETTY !== 'true') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pretty = require('pino-pretty');
  return pretty({
    destination: process.stdout,
    singleLine: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname,service',
  });
}

const options: Options = {
  level: process.env.LOG_LEVEL ?? 'info',
  // `level: "info"` instead of the default numeric `level: 30`.
  formatters: { level: (label: string) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  autoLogging: {
    ignore: (req: IncomingMessage) => IGNORED_PATHS.test(req.url ?? ''),
  },
  genReqId: (req: IncomingMessage, res: ServerResponse) => {
    const header = req.headers['x-request-id'];
    const requestId = (Array.isArray(header) ? header[0] : header) || randomUUID();
    res.setHeader('x-request-id', requestId);
    return requestId;
  },
  // Applies to every line, request completion logs included: the http
  // instrumentation keeps the server span active until the response ends.
  mixin: () => currentTraceFields(),
  customProps: () => ({ service: 'api' }),
};

const stream = prettyStream();

export const loggerParams: Params = {
  pinoHttp: stream ? [options, stream] : options,
};
