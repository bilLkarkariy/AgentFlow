import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

// Default OTLP endpoints if environment vars are not set
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
const OTLP_METRICS_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics';

// Initialize OpenTelemetry SDK (tracing and metrics)
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: OTLP_ENDPOINT }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: OTLP_METRICS_ENDPOINT,
    }),
    exportIntervalMillis: 1000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

// start sdk and catch errors (compatible with sync/async)
Promise.resolve(sdk.start()).catch(console.error);
