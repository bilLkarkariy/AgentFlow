/**
 * OpenTelemetry bootstrap. Imported first by `main.ts` so that the
 * auto-instrumentations can patch the modules before Nest loads them.
 *
 * Configuration is entirely environment driven (see plan §5 "Env api"):
 *   OTEL_SDK_DISABLED            true -> no SDK at all (also implied under Jest)
 *   OTEL_EXPORTER_OTLP_ENDPOINT  base OTLP/http endpoint, e.g. http://otel-collector:4318
 *   OTEL_SERVICE_NAME            service.name (default agentflow-api)
 *   OTEL_TRACES_SAMPLER(_ARG)    read natively by the SDK
 *   APP_VERSION / DEPLOY_ENV     resource attributes
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { envDetector, resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import type { IncomingMessage } from 'http';
import * as dotenv from 'dotenv';

// The SDK starts before Nest's ConfigModule, so read the .env file ourselves.
dotenv.config();

const disabled =
  process.env.OTEL_SDK_DISABLED === 'true' ||
  process.env.JEST_WORKER_ID !== undefined;

// Endpoints that must never create a server span (scrape + probe noise).
const IGNORED_PATHS = /^\/(health|metrics)/;

let sdk: NodeSDK | undefined;

if (!disabled) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'agentflow-api',
      [ATTR_SERVICE_VERSION]: process.env.APP_VERSION ?? 'dev',
      'deployment.environment.name': process.env.DEPLOY_ENV ?? 'local',
    }),
    // Only the (synchronous) env detector: host/os/process resolve their
    // attributes asynchronously, which makes the SDK log
    // "Accessing resource attributes before async attributes settled" on every
    // boot. Pod, node and container attributes are added by the collector's
    // k8sattributes processor anyway.
    resourceDetectors: [envDetector],
    // Reads OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_EXPORTER_OTLP_TRACES_ENDPOINT.
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req: IncomingMessage) =>
            IGNORED_PATHS.test(req.url ?? ''),
        },
      }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    // Flush the pending spans; Nest's own shutdown hooks own process exit.
    void sdk
      ?.shutdown()
      .catch(err => diag.warn('OpenTelemetry shutdown failed', err));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export { sdk };
