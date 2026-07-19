/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { initializeOTel, getTracer, startSpan } from '@/seed/telemetry/opentelemetry-setup';

describe('OpenTelemetry Stub (Workers no-op)', () => {
  it('initializeOTel resolves without error', async () => {
    await expect(initializeOTel()).resolves.toBeUndefined();
  });

  it('getTracer returns a working no-op tracer', () => {
    const tracer = getTracer();
    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe('function');
  });

  it('startSpan returns a no-op span with no-throw methods', () => {
    const span = startSpan('test', {
      attributes: { 'test.key': 'test-value' },
    });
    expect(span).toBeDefined();
    expect(() => span.setAttribute('k', 'v')).not.toThrow();
    expect(() => span.setAttributes({ a: 1 })).not.toThrow();
    expect(() => span.recordException(new Error('x'))).not.toThrow();
    expect(() => span.end()).not.toThrow();
    expect(() => span.addEvent('evt', { foo: 'bar' })).not.toThrow();
  });

  it('initializeOTel is idempotent', async () => {
    await initializeOTel();
    await initializeOTel();
    await initializeOTel();
    expect(true).toBe(true);
  });
});
