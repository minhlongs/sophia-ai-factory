/**
 * instrumentation.ts tests — Phase 01 TDD Production Readiness Sprint.
 *
 * Tests the Next.js instrumentation register hook.
 * Current state: register() is a no-op (disabled for Cloudflare Workers compatibility).
 * Target state: register() calls initializeOTel() from @/seed/telemetry/opentelemetry-setup.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockInitializeOTel: vi.fn().mockResolvedValue(undefined),
  mockGetTracer: vi.fn(),
  mockStartSpan: vi.fn(),
}));

vi.mock('@/seed/telemetry/opentelemetry-setup', () => ({
  initializeOTel: mocks.mockInitializeOTel,
  getTracer: mocks.mockGetTracer,
  startSpan: mocks.mockStartSpan,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('instrumentation.ts — register hook', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.mockInitializeOTel.mockReset();
    mocks.mockGetTracer.mockReset();
    mocks.mockStartSpan.mockReset();
  });

  it('exports register function (currently disabled/no-op)', async () => {
    // Currently register() is a no-op - it should exist and not throw
    const mod = await import('@/../instrumentation');
    expect(mod.register).toBeDefined();
    expect(typeof mod.register).toBe('function');

    // Should not throw when called
    await expect(mod.register()).resolves.toBeUndefined();
  });

  it('register() should call initializeOTel (post-fix expectation)', async () => {
    const { register } = await import('@/../instrumentation');
    await register();

    const { initializeOTel } = await import('@/seed/telemetry/opentelemetry-setup');
    expect(initializeOTel).toHaveBeenCalled();
  });

  it('register() should not throw if initializeOTel fails', async () => {
    mocks.mockInitializeOTel.mockRejectedValueOnce(new Error('No API key'));

    const { register } = await import('@/../instrumentation');
    // Should not throw — OTEL failure is non-fatal
    await expect(register()).resolves.toBeUndefined();
  });
});