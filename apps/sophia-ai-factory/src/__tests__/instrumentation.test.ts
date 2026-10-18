/**
 * instrumentation.ts tests — Phase 01 TDD Production Readiness Sprint.
 *
 * Tests the Next.js instrumentation register hook.
 * The Node runtime initializes OTel; the Edge runtime avoids Node-only exporter imports.
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

  it('exports register and leaves an unspecified runtime alone', async () => {
    const previousRuntime = process.env.NEXT_RUNTIME;
    delete process.env.NEXT_RUNTIME;

    try {
      const mod = await import('@/../instrumentation');
      expect(mod.register).toBeDefined();
      expect(typeof mod.register).toBe('function');
      await expect(mod.register()).resolves.toBeUndefined();
      expect(mocks.mockInitializeOTel).not.toHaveBeenCalled();
    } finally {
      if (previousRuntime === undefined) delete process.env.NEXT_RUNTIME;
      else process.env.NEXT_RUNTIME = previousRuntime;
    }
  });

  it('register() initializes Node-only OTel in the Node.js runtime', async () => {
    const previousRuntime = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = 'nodejs';

    try {
      const { register } = await import('@/../instrumentation');
      await register();
      expect(mocks.mockInitializeOTel).toHaveBeenCalledOnce();
    } finally {
      if (previousRuntime === undefined) delete process.env.NEXT_RUNTIME;
      else process.env.NEXT_RUNTIME = previousRuntime;
    }
  });

  it('does not import Node-only OTel in the Edge runtime', async () => {
    const previousRuntime = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = 'edge';

    try {
      const { register } = await import('@/../instrumentation');
      await expect(register()).resolves.toBeUndefined();
      expect(mocks.mockInitializeOTel).not.toHaveBeenCalled();
    } finally {
      if (previousRuntime === undefined) delete process.env.NEXT_RUNTIME;
      else process.env.NEXT_RUNTIME = previousRuntime;
    }
  });

  it('register() should not throw if initializeOTel fails', async () => {
    const previousRuntime = process.env.NEXT_RUNTIME;
    process.env.NEXT_RUNTIME = 'nodejs';
    mocks.mockInitializeOTel.mockRejectedValueOnce(new Error('No API key'));

    try {
      const { register } = await import('@/../instrumentation');
      await expect(register()).resolves.toBeUndefined();
    } finally {
      if (previousRuntime === undefined) delete process.env.NEXT_RUNTIME;
      else process.env.NEXT_RUNTIME = previousRuntime;
    }
  });
});
