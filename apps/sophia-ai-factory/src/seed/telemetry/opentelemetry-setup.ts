/**
 * OpenTelemetry initialization for Sophia AI Factory.
 * Sets up tracing (Honeycomb OTLP export) and metrics.
 * This module is idempotent — multiple calls are safe.
 */

import { trace, diag, DiagConsoleLogger, DiagLogLevel, SpanOptions } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http/build/esm/platform/node/OTLPTraceExporter';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http/build/esm/platform/node/OTLPMetricExporter';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { getPlatformConfig } from '@/seed/db/platform-config-repo';

let initialized = false;
let _meterProvider: MeterProvider | null = null;

/** Initialize OpenTelemetry SDK. Safe to call multiple times. */
export async function initializeOTel(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const logLevel = process.env.NODE_ENV === 'production' ? DiagLogLevel.ERROR : DiagLogLevel.DEBUG;
  diag.setLogger(new DiagConsoleLogger(), logLevel);

  const [configApiKey, configDataset] = await Promise.all([
    getPlatformConfig('honeycomb_api_key'),
    getPlatformConfig('honeycomb_dataset'),
  ]);

  const apiKey = configApiKey || process.env.HONEYCOMB_API_KEY;
  const dataset = configDataset || process.env.HONEYCOMB_DATASET || 'sophia-prod';
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://api.honeycomb.io';
  const serviceName = process.env.OTEL_SERVICE_NAME || 'sophia-api';
  const samplerate = parseFloat(process.env.OTEL_SAMPLERATE || '0.01');

  const headers: Record<string, string> = {
    'x-honeycomb-api-key': apiKey || '',
    'x-honeycomb-dataset': dataset,
  };

  const resource = resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers,
    timeoutMillis: 10000,
  });

  const tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(traceExporter)],
    sampler: new TraceIdRatioBasedSampler(samplerate),
  });

  trace.setGlobalTracerProvider(tracerProvider);

  const fetchInstrumentation = new FetchInstrumentation({});
  fetchInstrumentation.setTracerProvider(tracerProvider);
  fetchInstrumentation.enable();

  const metricExporter = new OTLPMetricExporter({
    url: `${endpoint}/v1/metrics`,
    headers,
    timeoutMillis: 10000,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000,
  });

  _meterProvider = new MeterProvider({
    resource,
    readers: [metricReader],
  });

  diag.info('[OTel] Initialized', { serviceName, sampleRate: samplerate, dataset });
}

/** Get the global tracer for creating manual spans. */
export function getTracer() {
  return trace.getTracer(process.env.OTEL_SERVICE_NAME || 'sophia-api');
}

/** Start a new span with the given name and options. */
export function startSpan(name: string, options?: SpanOptions) {
  return getTracer().startSpan(name, options);
}

/** Shutdown OTel providers gracefully (optional). */
export async function shutdown(): Promise<void> {
  if (_meterProvider) {
    await _meterProvider.forceFlush();
    await _meterProvider.shutdown();
  }
}
