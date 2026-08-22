/**
 * Regression test for the Inngest route handler.
 *
 * The route imports a set of functions from the forest barrel and passes them
 * to `serve({ functions: [...] })`. A function that is imported but omitted
 * from the array is silently unregistered — the trigger action emits an event
 * that no Inngest function serves, and the pipeline never runs.
 *
 * This test reads route.ts, extracts every identifier it imports from the
 * barrel, and asserts each one is present in the `functions` array passed to
 * `serve`. That is the exact invariant that was violated when
 * `youtubeContentPipeline` was imported but never registered.
 *
 * Note: this deliberately does NOT assert that every barrel export is
 * registered — deprecated handlers (Phase 06 video_jobs chain, removed per
 * ADR 0007) are intentionally exported from the barrel but not served.
 *
 * @module app/api/inngest/__tests__/route-registration
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mocks = vi.hoisted(() => ({
  serve: vi.fn((_opts: { functions: unknown[] }) => ({
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
  })),
}));

vi.mock('inngest/next', () => ({ serve: mocks.serve }));
vi.mock('@/forest/inngest/client', () => ({
  inngest: { createFunction: vi.fn((_cfg: unknown, _evt: unknown, handler: unknown) => handler) },
}));

// Importing the barrel AFTER the mocks are registered so the module graph
// resolves through the mocked inngest client.
const barrel = await import('@/forest/inngest/functions/index');

function importedIdentifiers(): string[] {
  const routePath = resolve(__dirname, '../route.ts');
  const source = readFileSync(routePath, 'utf8');
  const match = source.match(/import\s*\{([^}]*?)\}\s*from\s*["']@\/forest\/inngest\/functions\/index["']/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

describe('Inngest route registration', () => {
  it('registers every function the route imports from the barrel', async () => {
    await import('@/app/api/inngest/route');

    expect(mocks.serve).toHaveBeenCalledTimes(1);
    const registered = mocks.serve.mock.calls[0][0].functions;

    const imports = importedIdentifiers();
    expect(imports.length).toBeGreaterThan(0);

    for (const name of imports) {
      const value = (barrel as Record<string, unknown>)[name];
      expect(value, `route.ts imports "${name}" but the barrel does not export it`).toBeDefined();
      expect(
        registered,
        `route.ts imports "${name}" but it is not registered in serve()`,
      ).toContain(value);
    }
  });

  it('registers the YouTube content pipeline function', async () => {
    await import('@/app/api/inngest/route');

    const registered = mocks.serve.mock.calls[0][0].functions;
    expect(registered).toContain(barrel.youtubeContentPipeline);
  });
});