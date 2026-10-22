/**
 * Tests for the geo audience-jurisdiction write path.
 *
 * The compliance gate blocks regulated verticals when the tenant's declared
 * jurisdiction is unknown, so this suite pins the two properties that make the
 * gate usable: a valid code persists and becomes readable, and a malformed
 * code is rejected without persisting anything.
 *
 * Uses an in-memory D1 mock — no real DB required.
 *
 * @module app/api/v1/settings/geo/route.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

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

const { GET, PUT } = await import('./route');

function putRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/settings/geo', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function readStoredGeo(tenantId: string): Record<string, unknown> {
  const row = store.get(`${tenantId}::geo`);
  return row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
}

describe('PUT /api/v1/settings/geo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    mockGetCurrentUser.mockResolvedValue({ id: 'tenant-1' });
  });

  it('returns 401 when the caller has no session', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await PUT(putRequest({ targetJurisdiction: 'US' }));

    expect(res.status).toBe(401);
    expect(store.size).toBe(0);
  });

  it('persists a valid ISO country code', async () => {
    const res = await PUT(putRequest({ targetJurisdiction: 'US' }));

    expect(res.status).toBe(200);
    expect(readStoredGeo('tenant-1').targetJurisdiction).toBe('US');
  });

  it('accepts the EU bloc code', async () => {
    const res = await PUT(putRequest({ targetJurisdiction: 'EU' }));

    expect(res.status).toBe(200);
    expect(readStoredGeo('tenant-1').targetJurisdiction).toBe('EU');
  });

  it('normalizes a lowercase code to its canonical uppercase form', async () => {
    const res = await PUT(putRequest({ targetJurisdiction: 'vn' }));

    expect(res.status).toBe(200);
    expect(readStoredGeo('tenant-1').targetJurisdiction).toBe('VN');
  });

  it('rejects a malformed code with 422 and writes nothing', async () => {
    const res = await PUT(putRequest({ targetJurisdiction: 'United States' }));

    expect(res.status).toBe(422);
    expect(store.size).toBe(0);
  });

  it('rejects a single-letter code with 422', async () => {
    const res = await PUT(putRequest({ targetJurisdiction: 'U' }));

    expect(res.status).toBe(422);
    expect(store.size).toBe(0);
  });

  it('rejects a non-string code with 422', async () => {
    const res = await PUT(putRequest({ targetJurisdiction: 42 }));

    expect(res.status).toBe(422);
    expect(store.size).toBe(0);
  });

  it('rejects an invalid JSON body with 400', async () => {
    const req = new NextRequest('http://localhost/api/v1/settings/geo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const res = await PUT(req);

    expect(res.status).toBe(400);
    expect(store.size).toBe(0);
  });

  it('preserves existing block rules when the declaration is written', async () => {
    store.set('tenant-1::geo', {
      id: 'ts_1',
      tenant_id: 'tenant-1',
      namespace: 'geo',
      value: JSON.stringify({
        additionalRules: [{ category: 'crypto', blockedCountries: ['CN'], reason: 'tenant rule' }],
        removedRules: [{ category: 'gambling', country: 'US' }],
      }),
      schema_version: 1,
      created_at: '2026-10-21T00:00:00.000Z',
      updated_at: '2026-10-21T00:00:00.000Z',
    });

    const res = await PUT(putRequest({ targetJurisdiction: 'SG' }));

    expect(res.status).toBe(200);
    const stored = readStoredGeo('tenant-1');
    expect(stored.additionalRules).toEqual([
      { category: 'crypto', blockedCountries: ['CN'], reason: 'tenant rule' },
    ]);
    expect(stored.removedRules).toEqual([{ category: 'gambling', country: 'US' }]);
    expect(stored.targetJurisdiction).toBe('SG');
  });

  it('overwrites a previously declared jurisdiction without touching rules', async () => {
    store.set('tenant-1::geo', {
      id: 'ts_1',
      tenant_id: 'tenant-1',
      namespace: 'geo',
      value: JSON.stringify({
        targetJurisdiction: 'US',
        additionalRules: [{ category: 'crypto', blockedCountries: ['CN'] }],
        removedRules: [],
      }),
      schema_version: 1,
      created_at: '2026-10-21T00:00:00.000Z',
      updated_at: '2026-10-21T00:00:00.000Z',
    });

    const res = await PUT(putRequest({ targetJurisdiction: 'JP' }));

    expect(res.status).toBe(200);
    const stored = readStoredGeo('tenant-1');
    expect(stored.targetJurisdiction).toBe('JP');
    expect(stored.additionalRules).toEqual([{ category: 'crypto', blockedCountries: ['CN'] }]);
  });

  it('clears the declaration on null while preserving rules', async () => {
    store.set('tenant-1::geo', {
      id: 'ts_1',
      tenant_id: 'tenant-1',
      namespace: 'geo',
      value: JSON.stringify({
        targetJurisdiction: 'US',
        additionalRules: [{ category: 'crypto', blockedCountries: ['CN'] }],
        removedRules: [],
      }),
      schema_version: 1,
      created_at: '2026-10-21T00:00:00.000Z',
      updated_at: '2026-10-21T00:00:00.000Z',
    });

    const res = await PUT(putRequest({ targetJurisdiction: null }));

    expect(res.status).toBe(200);
    const stored = readStoredGeo('tenant-1');
    expect(stored).not.toHaveProperty('targetJurisdiction');
    expect(stored.additionalRules).toEqual([{ category: 'crypto', blockedCountries: ['CN'] }]);
  });

  it('scopes the write to the authenticated tenant only', async () => {
    store.set('tenant-2::geo', {
      id: 'ts_2',
      tenant_id: 'tenant-2',
      namespace: 'geo',
      value: JSON.stringify({ targetJurisdiction: 'VN', additionalRules: [], removedRules: [] }),
      schema_version: 1,
      created_at: '2026-10-21T00:00:00.000Z',
      updated_at: '2026-10-21T00:00:00.000Z',
    });

    await PUT(putRequest({ targetJurisdiction: 'US' }));

    expect(readStoredGeo('tenant-2').targetJurisdiction).toBe('VN');
  });
});

describe('GET /api/v1/settings/geo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    mockGetCurrentUser.mockResolvedValue({ id: 'tenant-1' });
  });

  it('returns 401 without a session', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await GET(
      new NextRequest('http://localhost/api/v1/settings/geo', { method: 'GET' }),
    );

    expect(res.status).toBe(401);
  });

  it('returns empty rule defaults with no declared jurisdiction when unset', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/v1/settings/geo', { method: 'GET' }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { namespace: string; value: Record<string, unknown> };
    expect(json.namespace).toBe('geo');
    expect(json.value).toEqual({ additionalRules: [], removedRules: [] });
    expect(json.value).not.toHaveProperty('targetJurisdiction');
  });

  it('round-trips a declaration written through PUT', async () => {
    await PUT(putRequest({ targetJurisdiction: 'US' }));

    const res = await GET(
      new NextRequest('http://localhost/api/v1/settings/geo', { method: 'GET' }),
    );

    const json = (await res.json()) as { value: { targetJurisdiction?: string } };
    expect(json.value.targetJurisdiction).toBe('US');
  });
});
