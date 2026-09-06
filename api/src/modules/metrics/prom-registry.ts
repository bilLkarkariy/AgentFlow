import {
  Counter,
  CounterConfiguration,
  Gauge,
  GaugeConfiguration,
  Histogram,
  HistogramConfiguration,
  collectDefaultMetrics,
  register,
} from 'prom-client';

/**
 * prom-client's default registry is process wide: registering the same metric
 * twice throws. Nest test modules re-instantiate providers within a single
 * process, so every metric goes through these helpers, which reuse whatever is
 * already registered under that name.
 */
export function getOrCreateCounter(
  config: CounterConfiguration<string>,
): Counter<string> {
  return (
    (register.getSingleMetric(config.name) as Counter<string>) ??
    new Counter({ ...config, registers: [register] })
  );
}

export function getOrCreateGauge(
  config: GaugeConfiguration<string>,
): Gauge<string> {
  return (
    (register.getSingleMetric(config.name) as Gauge<string>) ??
    new Gauge({ ...config, registers: [register] })
  );
}

export function getOrCreateHistogram(
  config: HistogramConfiguration<string>,
): Histogram<string> {
  return (
    (register.getSingleMetric(config.name) as Histogram<string>) ??
    new Histogram({ ...config, registers: [register] })
  );
}

/** Node runtime metrics (cpu, heap, event loop lag, handles), registered once. */
export function ensureDefaultMetrics(): void {
  if (register.getSingleMetric('process_cpu_user_seconds_total')) return;
  collectDefaultMetrics();
}
