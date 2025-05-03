// import { NodeSDK } from '@opentelemetry/sdk-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

// Set OTLP endpoints (default to localhost)
const defaultEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const traceUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ? process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '') + '/v1/traces'
  : defaultEndpoint.replace(/\/$/, '') + '/v1/traces';
const metricsUrl = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
  ? process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
  : defaultEndpoint.replace(/\/$/, '') + '/v1/metrics';

// Enable OpenTelemetry diagnostics
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
// Initialize OpenTelemetry SDK
// const sdk = new NodeSDK({
//   traceExporter: new OTLPTraceExporter({ url: traceUrl }),
//   metricReader: new PeriodicExportingMetricReader({
//     exporter: new OTLPMetricExporter({ url: metricsUrl }),
//     exportIntervalMillis: 1000,
//   }),
//   instrumentations: [getNodeAutoInstrumentations()],
// });

// Promise.resolve(sdk.start()).catch(console.error);
