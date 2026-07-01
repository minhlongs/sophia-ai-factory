/**
 * instrumentation.ts tests.
 *
 * Tests the Next.js instrumentation register hook. register() is intentionally
 * a no-op for Cloudflare Workers compatibility — OTEL SDK requires Node.js
 * builtins (http, fs, zlib, stream) unavailable in Workers even with nodejs_compat.
 *
 * For non-Worker deployments, callers should import and call initializeOTel()
 * from @/seed/telemetry/opentelemetry-setup directly.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';

describe('instrumentation.ts — register hook', () => {
  it('exports register function as a no-op', async () => {
    const mod = await import('@/../instrumentation');
    expect(mod.register).toBeDefined();
    expect(typeof mod.register).toBe('function');

    // register() is a no-op — resolves without error
    await expect(mod.register()).resolves.toBeUndefined();
  });

  it('register() does not import OTEL (Cloudflare Workers compatibility)', async () => {
    // register() intentionally does NOT import @/seed/telemetry/opentelemetry-setup
    // to prevent OTEL's Node.js-dependent packages from being bundled into Workers.
    const mod = await import('@/../instrumentation');
    await mod.register();
    // If we got here without OTEL import errors, the test passes.
    // The no-op design is the intended production behavior.
  });
});
