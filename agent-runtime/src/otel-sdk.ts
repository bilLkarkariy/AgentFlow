import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

// Default OTLP endpoints if environment vars are not set
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'localhost:4317';
const OTLP_METRICS_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics';

// Initialize OpenTelemetry SDK (tracing and metrics)
const traceExporter = new OTLPTraceExporter({ url: OTLP_ENDPOINT });
// fallback: exporter errors will be caught by NodeSDK start() catch
const sdk = new NodeSDK({
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: OTLP_METRICS_ENDPOINT,
    }),
    exportIntervalMillis: 1000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

// start sdk and catch errors (compatible with sync/async)
Promise.resolve(sdk.start()).catch(err => console.warn('OpenTelemetry start failed', err));
