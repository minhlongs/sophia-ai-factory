/**
 * OpenTelemetry initialization for Sophia AI Factory.
 * Sets up tracing (Honeycomb OTLP export) and metrics.
 *
 * This module is idempotent — multiple calls are safe.
 *
 * ALL @opentelemetry/* imports are DYNAMIC (import()) so they are excluded
 * from the Cloudflare Worker static bundle. Node.js-only packages like
 * @opentelemetry/exporter-trace-otlp-http/platform/node pull Node.js builtins
 * (http, zlib, fs) that crash Workers startup if bundled.
 */

// Node.js-only — never statically imported. Lazy-loaded inside initializeOTel().
// Keeping the type-only imports for compile-time checking only.
import type { Tracer } from '@opentelemetry/api';
import type { BasicTracerProvider, SimpleSpanProcessor, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import type { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import type { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';

let initialized = false;
let _meterProvider: MeterProvider | null = null;

// ── No-op fallback — used in Workers (OTel not available) ─────────────────────
// These plain objects satisfy the Span/Tracer interfaces with empty methods.
// No @opentelemetry/* runtime imports — they live at module scope so
// getTracer() and startSpan() are safe even before initializeOTel() runs.

interface NoOpSpan {
  setStatus(s: { code?: number; message?: string }): void;
  setAttribute(name: string, value: unknown): void;
  setAttributes(attrs: Record<string, unknown>): void;
  recordException(exception: unknown): void;
  end(): void;
  addEvent(name: string, attributesOrStartTime?: unknown, startTimeOrEndTime?: unknown): void;
}

const NOOP_SPAN: NoOpSpan = {
  setStatus: () => {},
  setAttribute: () => {},
  setAttributes: () => {},
  recordException: () => {},
  end: () => {},
  addEvent: () => {},
};

type NoOpTracer = {
  startSpan(name: string, options?: unknown): NoOpSpan;
};

function createNoOpTracer(): NoOpTracer {
  return {
    startSpan: (_name: string, _options?: unknown) => ({ ...NOOP_SPAN }),
  };
}

let _noopTracer: NoOpTracer = createNoOpTracer();

// ── Primitive stores ──────────────────────────────────────────────────────────
let _trace: typeof import('@opentelemetry/api').trace | null = null;
let _diag: typeof import('@opentelemetry/api').diag | null = null;
let _DiagConsoleLogger: unknown = null;
let _DiagLogLevel: unknown = null;
let _BasicTracerProvider: typeof BasicTracerProvider | null = null;
let _SimpleSpanProcessor: typeof SimpleSpanProcessor | null = null;
let _TraceIdRatioBasedSampler: typeof TraceIdRatioBasedSampler | null = null;
let _resourceFromAttributes: unknown = null;
let _SEMRESATTRS_SERVICE_NAME: string | null = null;
let _OTLPTraceExporterCtor: unknown = null;
let _OTLPMetricExporterCtor: unknown = null;
let _MeterProvider: typeof MeterProvider | null = null;
let _PeriodicExportingMetricReader: typeof PeriodicExportingMetricReader | null = null;
let _FetchInstrumentation: typeof FetchInstrumentation | null = null;

async function ensureLoaded(): Promise<void> {
  if (initialized) return;

  const api = await import('@opentelemetry/api');
  const sdkTrace = await import('@opentelemetry/sdk-trace-base');
  const resources = await import('@opentelemetry/resources');
  const semconv = await import('@opentelemetry/semantic-conventions');
  const traceExp = await import('@opentelemetry/exporter-trace-otlp-http/build/esm/platform/node/OTLPTraceExporter');
  const metricExp = await import('@opentelemetry/exporter-metrics-otlp-http/build/esm/platform/node/OTLPMetricExporter');
  const sdkMetrics = await import('@opentelemetry/sdk-metrics');
  const fetchInst = await import('@opentelemetry/instrumentation-fetch');

  _trace = api.trace;
  _diag = api.diag;
  _DiagConsoleLogger = api.DiagConsoleLogger;
  _DiagLogLevel = api.DiagLogLevel;
  _BasicTracerProvider = sdkTrace.BasicTracerProvider;
  _SimpleSpanProcessor = sdkTrace.SimpleSpanProcessor;
  _TraceIdRatioBasedSampler = sdkTrace.TraceIdRatioBasedSampler;
  _resourceFromAttributes = resources.resourceFromAttributes;
  _SEMRESATTRS_SERVICE_NAME = semconv.SEMRESATTRS_SERVICE_NAME;
  _OTLPTraceExporterCtor = traceExp.OTLPTraceExporter;
  _OTLPMetricExporterCtor = metricExp.OTLPMetricExporter;
  _MeterProvider = sdkMetrics.MeterProvider;
  _PeriodicExportingMetricReader = sdkMetrics.PeriodicExportingMetricReader;
  _FetchInstrumentation = fetchInst.FetchInstrumentation;
}

/** Initialize OpenTelemetry SDK. Safe to call multiple times. */
export async function initializeOTel(): Promise<void> {
  if (initialized) return;

  await ensureLoaded();

  initialized = true;

  // Enable debug diagnostics in development
  const logLevel = process.env.NODE_ENV === 'production'
    ? (_DiagLogLevel as { ERROR: string }).ERROR
    : (_DiagLogLevel as { DEBUG: string }).DEBUG;
  (_diag as { setLogger: (l: unknown, level: string) => void }).setLogger(
    _DiagConsoleLogger as new () => unknown,
    logLevel,
  );

  // Try platform_configs (BYOK) first, fallback to env var for backward compat
  const { getPlatformConfig } = await import('@/seed/db/platform-config-repo');
  const configApiKey = await getPlatformConfig('honeycomb_api_key');
  const configDataset = await getPlatformConfig('honeycomb_dataset');

  const apiKey = configApiKey || process.env.HONEYCOMB_API_KEY;
  const dataset = configDataset || process.env.HONEYCOMB_DATASET || 'sophia-prod';
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://api.honeycomb.io';
  const serviceName = process.env.OTEL_SERVICE_NAME || 'sophia-api';
  const samplerate = parseFloat(process.env.OTEL_SAMPLERATE || '0.01');

  const headers: Record<string, string> = {
    'x-honeycomb-api-key': apiKey || '',
    'x-honeycomb-dataset': dataset,
  };

  const resource = (_resourceFromAttributes as { fromAttributes: (a: Record<string, string>) => unknown }).fromAttributes({
    [(_SEMRESATTRS_SERVICE_NAME as string)]: serviceName,
  });

  // ── Tracing Setup ─────────────────────────────────────────────────────────────
  const traceExporter = new (_OTLPTraceExporterCtor as new (c: { url: string; headers: Record<string, string>; timeoutMillis: number }) => unknown)({
    url: `${endpoint}/v1/traces`,
    headers,
    timeoutMillis: 10000,
  });

  const spanProcessor = new (_SimpleSpanProcessor as new (e: unknown) => unknown)(traceExporter);

  const tracerProvider = new (_BasicTracerProvider as new (c: { resource: unknown; spanProcessors: unknown[]; sampler: unknown }) => unknown)({
    resource,
    spanProcessors: [spanProcessor],
    sampler: new (_TraceIdRatioBasedSampler as new (r: number) => unknown)(samplerate),
  });

  (_trace as { setGlobalTracerProvider: (p: unknown) => void }).setGlobalTracerProvider(tracerProvider);

  const fetchInstrumentation = new (_FetchInstrumentation as new (o?: { ignoreUrls?: RegExp[] }) => unknown)({});
  (fetchInstrumentation as { setTracerProvider: (p: unknown) => void }).setTracerProvider(tracerProvider);
  (fetchInstrumentation as { enable: () => void }).enable();

  // ── Metrics Setup ─────────────────────────────────────────────────────────────
  const metricExporter = new (_OTLPMetricExporterCtor as new (c: { url: string; headers: Record<string, string>; timeoutMillis: number }) => unknown)({
    url: `${endpoint}/v1/metrics`,
    headers,
    timeoutMillis: 10000,
  });

  const metricReader = new (_PeriodicExportingMetricReader as new (c: { exporter: unknown; exportIntervalMillis: number }) => unknown)({
    exporter: metricExporter,
    exportIntervalMillis: 60000,
  });

  _meterProvider = new (_MeterProvider as new (c: { readers: unknown[] }) => unknown)({
    readers: [metricReader],
  });

  (_diag as { info: (msg: string, meta?: unknown) => void }).info('[OTel] Initialized', {
    serviceName,
    sampleRate: samplerate,
    dataset,
  });
}

/** Get the global tracer for creating manual spans. */
export function getTracer(): Tracer {
  // In Workers (or before initializeOTel() is called), return a no-op tracer
  // so that instrument-api.ts and instrument-inngest.ts can safely create spans
  // that are silently discarded rather than crashing.
  if (!initialized) {
    return _noopTracer as unknown as Tracer;
  }

	return _trace!.getTracer('');
}

/** Start a new span with the given name and options. */
export function startSpan(name: string, options?: Parameters<Tracer['startSpan']>[1]) {
	return getTracer().startSpan(name, options);
}

/** Shutdown OTel providers gracefully (optional). */
export async function shutdown(): Promise<void> {
  if (_meterProvider) {
    await _meterProvider.forceFlush();
    await _meterProvider.shutdown();
  }
}
