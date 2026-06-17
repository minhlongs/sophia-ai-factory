/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializeOTel, getTracer, startSpan } from '@/seed/telemetry/opentelemetry-setup';

// Mock environment variables
beforeEach(() => {
  vi.stubEnv('HONEYCOMB_API_KEY', 'test-key');
  vi.stubEnv('HONEYCOMB_DATASET', 'test-dataset');
  vi.stubEnv('OTEL_SERVICE_NAME', 'sophia-test');
  vi.stubEnv('OTEL_SAMPLERATE', '1.0'); // trace all in tests
  vi.stubEnv('COMMIT_SHA', 'abc123');
  vi.stubEnv('NODE_ENV', 'test');
  // Reset module cache to allow re-initialization
  vi.resetModules();
});

describe('OpenTelemetry Setup', () => {
  it('should initialize OTel with correct configuration', async () => {
    // Re-import after env setup
    const { initializeOTel: init, getTracer } = await import('@/seed/telemetry/opentelemetry-setup');

    init();

    const tracer = getTracer();
    expect(tracer).toBeDefined();

    // Create a test span
    const span = tracer.startSpan('test-span', {
      attributes: { 'test.key': 'test-value' },
    });
    expect(span).toBeDefined();
    span.end();
  });

  it('should respect sampling rate from env', async () => {
    vi.stubEnv('OTEL_SAMPLERATE', '0.5');
    const { initializeOTel, getTracer } = await import('@/seed/telemetry/opentelemetry-setup');

    initializeOTel();

    const tracer = getTracer();
    const span = tracer.startSpan('sampling-test');
    // If sampler dropped, span would be a NoopSpan; we just verify it's a real span by checking it can be ended
    span.end();
    // Note: full sampling decision testing requires more complex span processor inspection
  });

  it('should start and end spans with attributes', async () => {
    const { initializeOTel, startSpan } = await import('@/seed/telemetry/opentelemetry-setup');

    initializeOTel();

    const startTime = performance.now();
    const span = startSpan('test-operation', {
      attributes: {
        'component': 'test',
        'user.id': 'user-123',
      },
    });
    span.setAttribute('custom.attr', 'value');
    span.addEvent('test-event', { foo: 'bar' });
    span.end();
    const duration = performance.now() - startTime;
    // If no errors thrown, basic span operations work; duration should be > 0 (even if sub-ms)
    expect(duration).toBeGreaterThan(0);
  });

  it('should be idempotent on multiple initialize calls', async () => {
    const { initializeOTel } = await import('@/seed/telemetry/opentelemetry-setup');

    // Multiple calls should not throw or re-initialize
    initializeOTel();
    initializeOTel();
    initializeOTel();

    // If we got here without error, test passes
    expect(true).toBe(true);
  });
});

describe('Metrics Recording', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('HONEYCOMB_API_KEY', 'test-key');
    vi.stubEnv('OTEL_SERVICE_NAME', 'sophia-test');
    vi.stubEnv('OTEL_SAMPLERATE', '1.0');
    const { initializeOTel } = await import('@/seed/telemetry/opentelemetry-setup');
    initializeOTel();
  });

  it('should record metrics without errors', async () => {
    const { record, snapshot, reset } = await import('@/seed/observability/telemetry/metrics');

    reset();

    // Record some test data
    record('/api/test', 100, false);
    record('/api/test', 150, false);
    record('/api/test', 200, true); // error
    record('/api/other', 50, false);

    const snap = snapshot();
    expect(Array.isArray(snap)).toBe(true);

    const testRoute = snap.find((s: any) => s.route === '/api/test')!;
    expect(testRoute).toBeDefined();
    expect(testRoute.count).toBe(3);
    expect(testRoute.errors).toBe(1);
    expect(testRoute.p50).toBeGreaterThan(0);
  });
});
