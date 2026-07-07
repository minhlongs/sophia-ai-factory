/**
 * instrumentation.ts tests.
 * Tests the Next.js instrumentation register hook.
 *
 * @vitest-environment node
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const _dir = path.dirname(fileURLToPath(import.meta.url));
const instrumentationPath = path.join(_dir, '..', '..', 'instrumentation.ts');

const mocks = vi.hoisted(() => ({
  mockInitializeOTel: vi.fn(),
}));

vi.mock('@/seed/telemetry/opentelemetry-setup', () => ({
  initializeOTel: mocks.mockInitializeOTel,
  getTracer: vi.fn(),
  startSpan: vi.fn(),
}));

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

  it('register() calls initializeOTel in Node.js runtime', async () => {
    mocks.mockInitializeOTel.mockResolvedValue(undefined);

    const mod = await import(instrumentationPath);
    await mod.register();

    expect(mocks.mockInitializeOTel).toHaveBeenCalledTimes(1);
  });

  it('register() does not throw if initializeOTel fails', async () => {
    mocks.mockInitializeOTel.mockRejectedValue(new Error('No API key'));

    const mod = await import(instrumentationPath);
    await expect(mod.register()).resolves.toBeUndefined();
  });

  it('register() skips OTel in Cloudflare Workers runtime', async () => {
    const origProcess = (globalThis as any).process;
    const origWindow = (globalThis as any).window;
    const origFetch = (globalThis as any).fetch;
    try {
      delete (globalThis as any).process;
      (globalThis as any).window = undefined;
      (globalThis as any).fetch = () => Promise.resolve(new Response());

      vi.resetModules();
      const mod = await import(instrumentationPath);
      await mod.register();
      expect(mocks.mockInitializeOTel).not.toHaveBeenCalled();
    } finally {
      (globalThis as any).process = origProcess;
      (globalThis as any).window = origWindow;
      (globalThis as any).fetch = origFetch;
    }
  });
});
