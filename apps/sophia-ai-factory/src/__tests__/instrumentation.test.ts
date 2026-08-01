import { vi, describe, it, expect, beforeEach } from 'vitest';

// instrumentation.ts lives at the app root (two levels above src/)
const instrumentationPath = '/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/instrumentation.ts';

describe('instrumentation.ts', () => {
  beforeEach(() => {
    // Default: jsdom has no NEXT_RUNTIME → falls through to process.versions check (also absent) → Workers mode
    delete (process.env as Record<string, string | undefined>).NEXT_RUNTIME;
    vi.resetModules();
  });

  it('calls initializeOTel in Node.js runtime', async () => {
    // Simulate Node.js: Next.js sets NEXT_RUNTIME=node in node builds
    ;(process.env as Record<string, string | undefined>).NEXT_RUNTIME = 'node';

    const fakeInit = vi.fn().mockResolvedValue(undefined);

    // __setInitializeOTelForTests injects the mock directly into the module-scope cache,
    // bypassing the dynamic import that vi.mock() cannot intercept through Vite aliases.
    const { register, __setInitializeOTelForTests } = await import(instrumentationPath);
    __setInitializeOTelForTests(fakeInit);

    await register();

    expect(fakeInit).toHaveBeenCalledTimes(1);
  });

  it('does not throw if initializeOTel fails', async () => {
    ;(process.env as Record<string, string | undefined>).NEXT_RUNTIME = 'node';

    const fakeInit = vi.fn().mockRejectedValue(new Error('OTel down'));

    const { register, __setInitializeOTelForTests } = await import(instrumentationPath);
    __setInitializeOTelForTests(fakeInit);

    // OTel failure is non-fatal — register() must not throw
    await expect(register()).resolves.toBeUndefined();
  });

  it('skips OTel in Workers runtime', async () => {
    // Simulate Cloudflare Workers: Next.js sets NEXT_RUNTIME=edge
    ;(process.env as Record<string, string | undefined>).NEXT_RUNTIME = 'edge';

    const fakeInit = vi.fn();

    const { register, __setInitializeOTelForTests } = await import(instrumentationPath);
    __setInitializeOTelForTests(fakeInit);

    // In Workers mode, register returns before calling initializeOTel
    await register();
    expect(fakeInit).not.toHaveBeenCalled();
  });
});
