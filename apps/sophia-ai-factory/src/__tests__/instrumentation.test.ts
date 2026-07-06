/**
 * instrumentation.ts tests.
 *
 * Tests the Next.js instrumentation register hook.
 *
 * @vitest-environment node
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Resolve project-root instrumentation.ts (vitest @ alias resolves to ./src)
const _dir = path.dirname(fileURLToPath(import.meta.url));
const instrumentationPath = path.join(_dir, '..', '..', 'instrumentation.ts');

// Hoisted mocks — must be top-level so vitest hoisting works
const mocks = vi.hoisted(() => ({
  mockInitializeOTel: vi.fn(),
}));

vi.mock('@/seed/telemetry/opentelemetry-setup', () => ({
  initializeOTel: mocks.mockInitializeOTel,
  getTracer: vi.fn(),
  startSpan: vi.fn(),
}));

/**
 * TDD: Tests for the Next.js instrumentation register hook.
 *
 * Phases:
 *  - RED:    test "calls initializeOTel" fails because register() is no-op
 *  - GREEN:  after Phase 02 fix, register() calls initializeOTel() with try/catch
 *  - REFACT: verify graceful failure path
 */

describe('instrumentation.ts — register hook', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.mockInitializeOTel.mockReset();
  });

  it('exports register function', async () => {
    const mod = await import(instrumentationPath);
    expect(mod.register).toBeDefined();
    expect(typeof mod.register).toBe('function');
  });

  it('register() should call initializeOTel after fix', async () => {
    mocks.mockInitializeOTel.mockResolvedValue(undefined);

    const mod = await import(instrumentationPath);
    await mod.register();

    expect(mocks.mockInitializeOTel).toHaveBeenCalledTimes(1);
  });

  it('register() should not throw if initializeOTel fails', async () => {
    mocks.mockInitializeOTel.mockRejectedValue(new Error('No API key'));

    const mod = await import(instrumentationPath);
    // OTEL failure is non-fatal — app must still serve traffic
    await expect(mod.register()).resolves.toBeUndefined();
  });
});
