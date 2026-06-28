/**
 * OpenTelemetry initialization for Sophia AI Factory.
 * Sets up tracing (Honeycomb OTLP export) and metrics.
 *
 * This module is idempotent — multiple calls are safe.
 */

import { trace, diag, DiagConsoleLogger, DiagLogLevel, SpanOptions } from '@opentelemetry/api';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http/build/esm/platform/browser/OTLPTraceExporter';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http/build/esm/platform/browser/OTLPMetricExporter';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';

let initialized = false;
let _meterProvider: MeterProvider | null = null;

/**
 * Initialize OpenTelemetry SDK. Safe to call multiple times.
 */
export async function initializeOTel(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // Enable debug diagnostics in development
  const logLevel = process.env.NODE_ENV === 'production' ? DiagLogLevel.ERROR : DiagLogLevel.DEBUG;
  diag.setLogger(new DiagConsoleLogger(), logLevel);

  const apiKey = process.env.HONEYCOMB_API_KEY;
  const dataset = process.env.HONEYCOMB_DATASET || 'sophia-prod';
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://api.honeycomb.io';
  const serviceName = process.env.OTEL_SERVICE_NAME || 'sophia-api';
  const samplerate = parseFloat(process.env.OTEL_SAMPLERATE || '0.01');

  // Honeycomb requires API key and dataset headers
  const headers: Record<string, string> = {
    'x-honeycomb-api-key': apiKey || '',
    'x-honeycomb-dataset': dataset,
  };

  // Resource attaches service.name to all spans/metrics
  const resource = resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
  });

  // ── Tracing Setup ─────────────────────────────────────────────────────────────

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers,
    timeoutMillis: 10000,
  });

  const spanProcessor = new SimpleSpanProcessor(traceExporter);

  const tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: [spanProcessor],
    sampler: new TraceIdRatioBasedSampler(samplerate),
  });

  // Register globally so fetch instrumentation and manual spans use it
  trace.setGlobalTracerProvider(tracerProvider);

  // Instrument fetch API to automatically trace outgoing requests
  const fetchInstrumentation = new FetchInstrumentation({
    // Optionally ignore tracing for certain URLs
    // ignoreUrls: [/^https?:\/\/localhost\/api\/health/],
  });
  fetchInstrumentation.setTracerProvider(tracerProvider);
  fetchInstrumentation.enable();

  // ── Metrics Setup ─────────────────────────────────────────────────────────────

  const metricExporter = new OTLPMetricExporter({
    url: `${endpoint}/v1/metrics`,
    headers,
    timeoutMillis: 10000,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000, // 60 seconds
  });

  _meterProvider = new MeterProvider({
    resource,
    readers: [metricReader],
  });

  initialized = true;
  diag.info('[OTel] Initialized', { serviceName, sampleRate: samplerate, dataset });
}

/**
 * Get the global tracer for creating manual spans.
 */
export function getTracer() {
  return trace.getTracer(process.env.OTEL_SERVICE_NAME || 'sophia-api');
}

/**
 * Start a new span with the given name and options.
 */
export function startSpan(name: string, options?: SpanOptions) {
  return getTracer().startSpan(name, options);
}

/**
 * Shutdown OTel providers gracefully (optional).
 */
export async function shutdown(): Promise<void> {
  if (_meterProvider) {
    await _meterProvider.forceFlush();
    await _meterProvider.shutdown();
  }
}

// Auto-initialize on module load to ensure OTel is ready before any spans are created.
// This is safe to call multiple times (idempotent).
initializeOTel();
