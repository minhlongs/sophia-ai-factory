/**
 * instrumentation.ts TDD tests — Phase 01 Production Readiness Sprint.
 *
 * Tests the Next.js instrumentation register hook. Currently register() is
 * a disabled no-op. After Phase 02 fix, register() will call initializeOTel().
 *
 * Strategy:
 *   - Test 1: register() is a no-op today (PASSES now — baseline)
 *   - Test 2: register() should call initializeOTel (FAILS now — TDD red)
 *   - Test 3: register() handles initializeOTel failure gracefully (PASSES now)
 *
 * After Phase 02 enables the hook, all 3 tests should pass.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('instrumentation.ts — register hook', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports register function (currently disabled no-op)', async () => {
    // Dynamic import to get fresh module state after resetModules
    const mod = await import('@/../instrumentation');
    expect(mod.register).toBeDefined();
    expect(typeof mod.register).toBe('function');

    // Current behavior: register() is a no-op, should not throw
    await expect(mod.register()).resolves.toBeUndefined();
  });

  it('register() should call initializeOTel (TDD: FAILS until Phase 02 fix)', async () => {
    // Mock initializeOTel — this is what the fixed register() will call
    const mockInit = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@/seed/telemetry/opentelemetry-setup', () => ({
      initializeOTel: mockInit,
      getTracer: vi.fn(),
      startSpan: vi.fn(),
    }));

    const mod = await import('@/../instrumentation');
    await mod.register();

    // TDD red: currently register() is disabled, so initializeOTel is NOT called.
    // After Phase 02 fix, this assertion must pass.
    expect(mockInit).toHaveBeenCalled();
  });

  it('register() should not throw if initializeOTel fails (graceful degradation)', async () => {
    // OTEL initialization failure must NOT crash the app.
    // Production must still serve traffic even if Honeycomb is unreachable.
    const mockInit = vi.fn().mockRejectedValue(
      new Error('HONEYCOMB_API_KEY not configured'),
    );

    vi.doMock('@/seed/telemetry/opentelemetry-setup', () => ({
      initializeOTel: mockInit,
      getTracer: vi.fn(),
      startSpan: vi.fn(),
    }));

    const mod = await import('@/../instrumentation');
    await expect(mod.register()).resolves.toBeUndefined();
  });
});
