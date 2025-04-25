import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

// Set OTLP endpoints (default to localhost)
const traceUrl = process.env.OTLP_TRACE_ENDPOINT || 'http://localhost:4317';
const metricsUrl = process.env.OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: traceUrl }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: metricsUrl }),
    exportIntervalMillis: 1000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

Promise.resolve(sdk.start()).catch(console.error);
