// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CRON_ROUTES,
  IDEMPOTENCY_MARKER,
  PERMITTED_CRON_ROUTES,
  assertCronAlignment,
  buildVerifiedRouteMap,
  injectScheduledHandler,
  routeExists,
} from '../inject-scheduled-handler.mjs';

const APP_ROOT = path.resolve(process.cwd());
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-sched-test-'));
  tempDirs.push(dir);
  return dir;
}

function createFakeAppTree(routes: string[]): string {
  const root = makeTempDir();
  for (const route of routes) {
    const rel = route.replace(/^\/api\/cron\//, '');
    const file = path.join(root, 'src', 'app', 'api', 'cron', rel, 'route.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'export async function GET() { return new Response("ok"); }\n', 'utf8');
  }
  return root;
}

interface GeneratedWorkerModule {
  default: {
    fetch: () => Promise<Response>;
    scheduled: (
      event: { cron?: string },
      env: Record<string, unknown>,
      ctx?: { waitUntil?: (promise: Promise<unknown>) => void }
    ) => Promise<void>;
  };
  scheduled: (
    event: { cron?: string },
    env: Record<string, unknown>,
    ctx?: { waitUntil?: (promise: Promise<unknown>) => void }
  ) => Promise<void>;
}

async function buildAndImportWorker(
  routeMap: Record<string, string[]>,
  routesOnDisk: string[],
  trailingComma = true,
  permittedRoutes = routesOnDisk,
) {
  const rootDir = createFakeAppTree(routesOnDisk);
  fs.writeFileSync(path.join(rootDir, 'wrangler.toml'), '[triggers]\ncrons = ' + JSON.stringify(Object.keys(routeMap)) + '\n');
  const workerFilePath = path.join(rootDir, 'worker.mjs');
  const comma = trailingComma ? ',' : '';
  const initialWorker = [
    'export default {',
    `    async fetch() { return new Response("fetch-ok"); }${comma}`,
    '};',
    '',
  ].join('\n');
  fs.writeFileSync(workerFilePath, initialWorker, 'utf8');

  const first = injectScheduledHandler({ workerFilePath, routeMap, rootDir, permittedRoutes });
  const encoded = Buffer.from(fs.readFileSync(workerFilePath, 'utf8'), 'utf8').toString('base64');
  const mod = (await import(
    /* @vite-ignore */ `data:text/javascript;base64,${encoded}`
  )) as GeneratedWorkerModule;
  return { rootDir, workerFilePath, first, mod };
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('inject-scheduled-handler build-time validation', () => {
  it('verifies every mapped route in CRON_ROUTES exists and exports GET', () => {
    const verified = buildVerifiedRouteMap(CRON_ROUTES, APP_ROOT);
    const patterns = Object.keys(verified);
    const routes = Object.values(verified).flat();

    expect(patterns.length).toBe(23);
    expect(() => assertCronAlignment(verified, APP_ROOT)).not.toThrow();
    expect(verified['30 3 * * *']).toContain('/api/cron/hash-chain-verification');
    expect(verified['0 5 * * *']).toContain('/api/cron/d1-backup');
    expect(routes).not.toContain('/api/cron/usage-export');

    for (const route of routes) {
      expect(routeExists(route, APP_ROOT)).toBe(true);
      const rel = route.replace(/^\/api\/cron\//, '');
      const source = fs.readFileSync(
        path.join(APP_ROOT, 'src', 'app', 'api', 'cron', rel, 'route.ts'),
        'utf8'
      );
      expect(source).toMatch(
        /export\s+(?:async\s+)?function\s+GET\b|export\s+const\s+GET\b|export\s*\{[\s\S]*?\bGET\b/
      );
    }
  });

  it('skips policy-disabled routes without invoking the Worker binding', async () => {
    const { mod } = await buildAndImportWorker(
      { '0 5 * * *': ['/api/cron/error-digest'] },
      ['/api/cron/error-digest'],
      true,
      [],
    );
    const fetch = vi.fn();
    const result = await mod.scheduled(
      { cron: '0 5 * * *' },
      { CRON_SECRET: 'test-secret', WORKER_SELF_REFERENCE: { fetch } },
    );

    expect(result).toEqual({
      ok: true,
      skipped: 'SKIPPED_BY_POLICY',
      routes: ['/api/cron/error-digest'],
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects drift in either direction even when worker was already injected', async () => {
    const { rootDir, workerFilePath } = await buildAndImportWorker(
      { '5 * * * *': ['/api/cron/hourly-rollup'] }, ['/api/cron/hourly-rollup']
    );
    fs.writeFileSync(path.join(rootDir, 'wrangler.toml'), '[triggers]\ncrons = ["0 9 * * *"]\n');
    expect(() => injectScheduledHandler({ workerFilePath, rootDir,
      routeMap: { '5 * * * *': ['/api/cron/hourly-rollup'] },
    })).toThrow(/Cron alignment failed: unmapped triggers \[0 9 \* \* \*\]; unscheduled handlers \[5 \* \* \* \*\]/);
  });

  it('throws instead of silently skipping when any mapped route file is missing', () => {
    const rootDir = createFakeAppTree(['/api/cron/hourly-rollup']);
    expect(() =>
      buildVerifiedRouteMap(
        { '5 * * * *': ['/api/cron/missing-route', '/api/cron/hourly-rollup'] },
        rootDir
      )
    ).toThrow(/Missing cron route file\(s\): 5 \* \* \* \* -> \/api\/cron\/missing-route/);
  });

  it('throws on empty route map, empty pattern array, or invalid route path', () => {
    const rootDir = createFakeAppTree(['/api/cron/hourly-rollup']);
    expect(() => buildVerifiedRouteMap({}, rootDir)).toThrow(/No cron route patterns configured/);
    expect(() => buildVerifiedRouteMap({ '5 * * * *': [] }, rootDir)).toThrow(
      /has no configured routes/
    );
    expect(routeExists('/api/other/hourly-rollup', rootDir)).toBe(false);
    expect(routeExists('/api/cron/../other', rootDir)).toBe(false);
  });

  it('injects idempotently with or without trailing comma and exits non-zero when worker.js is missing', async () => {
    const { workerFilePath, first, mod } = await buildAndImportWorker(
      { '5 * * * *': ['/api/cron/hourly-rollup'] },
      ['/api/cron/hourly-rollup'],
      false
    );
    expect(first).toEqual({ injected: true, patternCount: 1, routeCount: 1 });
    expect(typeof mod.default.scheduled).toBe('function');
    expect(typeof mod.scheduled).toBe('function');

    const contentAfterFirst = fs.readFileSync(workerFilePath, 'utf8');
    expect(contentAfterFirst).toContain(IDEMPOTENCY_MARKER);

    const second = injectScheduledHandler({
      workerFilePath,
      routeMap: { '5 * * * *': ['/api/cron/hourly-rollup'] },
      rootDir: path.dirname(workerFilePath),
    });
    expect(second.injected).toBe(false);
    expect(fs.readFileSync(workerFilePath, 'utf8')).toBe(contentAfterFirst);

    const emptyRoot = makeTempDir();
    expect(() => injectScheduledHandler({ workerFilePath: path.join(emptyRoot, 'missing.js') }))
      .toThrow(/worker.js not found/);
  });
});

describe('generated scheduled() handler runtime behavior', () => {
  it('runs the bundled backup with only D1/R2 bindings and fails secret checks before touching them', async () => {
    const { mod, workerFilePath } = await buildAndImportWorker(
      { '0 5 * * *': ['/api/cron/d1-backup'] }, ['/api/cron/d1-backup'],
    );
    const run = vi.fn().mockResolvedValue({ success: true });
    const first = vi.fn().mockResolvedValue(null);
    const prepare = vi.fn(() => ({ bind: () => ({ first, run }), all: async () => ({ results: [] }) }));
    const put = vi.fn(async (_key: string, bytes: Uint8Array) => ({ size: bytes.byteLength }));
    const env = { CRON_SECRET: 'unit-cron-token', DB: { prepare }, BACKUPS_BUCKET: { head: async () => null, put } };
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected outbound'));
    await expect(mod.scheduled({ cron: '0 5 * * *' }, { ...env, CRON_SECRET: ' ' })).rejects.toThrow(/CRON_SECRET/);
    expect(prepare).not.toHaveBeenCalled();
    await mod.scheduled({ cron: '0 5 * * *' }, env);
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^d1-.*\.sql$/), expect.any(Uint8Array), expect.objectContaining({ onlyIf: { etagDoesNotMatch: '*' } }));
    expect(run).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    const generated = fs.readFileSync(workerFilePath, 'utf8');
    expect(generated).not.toContain('next/server');
    expect(generated).not.toContain('Honeycomb');
  });

  it('dispatches only backup and skips the other registered routes', async () => {
    const registry = Object.values(CRON_ROUTES).flat();
    const { mod } = await buildAndImportWorker(CRON_ROUTES, registry, true, PERMITTED_CRON_ROUTES);
    const outbound = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected outbound fetch'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const binding = vi.fn(async () => new Response(null, { status: 204 }));
    const first = vi.fn().mockResolvedValue({ last_run_at: 1 });
    const db = { prepare: vi.fn(() => ({ bind: () => ({ first }) })) };
    const env = { CRON_SECRET: 'unit-cron-token', DB: db, BACKUPS_BUCKET: {}, HOSTNAME: 'worker.invalid', WORKER_SELF_REFERENCE: { fetch: binding } };
    for (const [cron, routes] of Object.entries(CRON_ROUTES)) {
      binding.mockClear();
      const allowed = routes.filter((route) => PERMITTED_CRON_ROUTES.includes(route));
      const result = await mod.scheduled({ cron }, env);
      expect(binding).not.toHaveBeenCalled();
      if (allowed.length === 0) expect(result).toEqual({ ok: true, skipped: 'SKIPPED_BY_POLICY', routes });
    }
    expect(registry.filter((route) => !PERMITTED_CRON_ROUTES.includes(route))).toHaveLength(39);
    expect(first).toHaveBeenCalledTimes(1);
    expect(outbound).not.toHaveBeenCalled();
  });

  it('throws on missing or whitespace CRON_SECRET before dispatching any request', async () => {
    const { mod } = await buildAndImportWorker(
      { '5 * * * *': ['/api/cron/hourly-rollup'] },
      ['/api/cron/hourly-rollup']
    );
    const selfFetch = vi.fn();

    await expect(
      mod.default.scheduled({ cron: '5 * * * *' }, { WORKER_SELF_REFERENCE: { fetch: selfFetch } }, {})
    ).rejects.toThrow(/CRON_SECRET is missing or empty/);

    await expect(
      mod.scheduled({ cron: '0 9 * * *' }, { CRON_SECRET: '   ', WORKER_SELF_REFERENCE: { fetch: selfFetch } }, {})
    ).rejects.toThrow(/CRON_SECRET is missing or empty/);

    expect(selfFetch).not.toHaveBeenCalled();
  });

  it('dispatches only via WORKER_SELF_REFERENCE with Bearer auth and resolves on 2xx', async () => {
    const { mod } = await buildAndImportWorker(
      { '5 * * * *': ['/api/cron/hourly-rollup'] },
      ['/api/cron/hourly-rollup']
    );
    const waitUntil = vi.fn();
    const selfFetch = vi.fn(async (req: Request) => {
      expect(req.method).toBe('GET');
      expect(req.url).toBe('https://custom.example.com/api/cron/hourly-rollup');
      expect(req.headers.get('Authorization')).toBe('Bearer unit-cron-token');
      return new Response('ok', { status: 200 });
    });

    await expect(
      mod.default.scheduled(
        { cron: '5 * * * *' },
        { CRON_SECRET: 'unit-cron-token', HOSTNAME: 'custom.example.com', WORKER_SELF_REFERENCE: { fetch: selfFetch } },
        { waitUntil }
      )
    ).resolves.toBeUndefined();
    expect(selfFetch).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);

    const globalFetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected outbound fetch'));
    await expect(
      mod.default.scheduled({ cron: '5 * * * *' }, { CRON_SECRET: 'unit-cron-token' }, {})
    ).rejects.toThrow(/WORKER_SELF_REFERENCE is unavailable/);
    expect(globalFetchSpy).not.toHaveBeenCalled();

    // Unmapped cron pattern with valid secret returns cleanly without calling fetch
    await expect(
      mod.default.scheduled({ cron: '0 9 * * *' }, { CRON_SECRET: 'unit-cron-token' }, {})
    ).resolves.toBeUndefined();
    expect(globalFetchSpy).not.toHaveBeenCalled();
  });

  it('throws on HTTP non-2xx, network/non-network errors, and runs all sibling routes before rejecting', async () => {
    const { mod } = await buildAndImportWorker(
      { '*/2 * * * *': ['/api/cron/fulfillment-retry', '/api/cron/email-outbox-flush'] },
      ['/api/cron/fulfillment-retry', '/api/cron/email-outbox-flush']
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const visited: string[] = [];
    const partialFailFetch = vi.fn(async (req: Request) => {
      const pathname = new URL(req.url).pathname;
      visited.push(pathname);
      if (pathname === '/api/cron/fulfillment-retry') {
        return new Response('SENSITIVE_DB_ERROR_BODY', { status: 500 });
      }
      return new Response('ok', { status: 200 });
    });

    await expect(
      mod.default.scheduled(
        { cron: '*/2 * * * *' },
        { CRON_SECRET: 'unit-cron-token', WORKER_SELF_REFERENCE: { fetch: partialFailFetch } },
        { waitUntil: vi.fn() }
      )
    ).rejects.toThrow(/1 of 2 cron route\(s\) failed.*\/api\/cron\/fulfillment-retry failed with HTTP 500/);
    expect(visited).toEqual(['/api/cron/fulfillment-retry', '/api/cron/email-outbox-flush']);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('SENSITIVE_DB_ERROR_BODY');
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('unit-cron-token');

    const networkFailFetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('socket hang up'))
      .mockResolvedValueOnce(null);

    await expect(
      mod.default.scheduled(
        { cron: '*/2 * * * *' },
        { CRON_SECRET: 'unit-cron-token', WORKER_SELF_REFERENCE: { fetch: networkFailFetch } },
        {}
      )
    ).rejects.toThrow(
      /2 of 2 cron route\(s\) failed.*dispatch failed: socket hang up.*invalid HTTP response/
    );
  });
});
