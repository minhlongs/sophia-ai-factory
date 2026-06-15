/**
 * Integration tests: per-tenant overrides for scoring, geo, and cron namespaces.
 * Uses the same in-memory D1 mock as registry.test.ts.
 * @module lib/tenant-settings/__tests__/per-tenant-overrides-integration.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { get, set, getOrDefault, deleteNamespace } from '../registry';
import { ScoringSchema, GeoSchema, CronSchema } from '../namespace-validators';
import {
  DEFAULT_SCORING,
  DEFAULT_GEO,
  DEFAULT_CRON,
} from '../defaults';

// ---------------------------------------------------------------------------
// Minimal in-memory D1 mock (same pattern as registry.test.ts)
// ---------------------------------------------------------------------------

type Row = {
  id: string;
  tenant_id: string;
  namespace: string;
  value: string;
  schema_version: number;
  created_at: string;
  updated_at: string;
};

function makeD1Mock(): D1Database {
  const store = new Map<string, Row>();

  function key(tenantId: string, ns: string) {
    return `${tenantId}::${ns}`;
  }

  const db = {
    prepare: (sql: string) => {
      const stmt = {
        _sql: sql,
        _binds: [] as unknown[],
        bind: (...args: unknown[]) => {
          stmt._binds = args;
          return stmt;
        },
        run: async () => {
          const s = stmt._sql.trim();
          if (s.startsWith('INSERT INTO tenant_settings')) {
            const [id, tenant_id, namespace, value, , created_at, updated_at] =
              stmt._binds as string[];
            const k = key(tenant_id, namespace);
            if (s.includes('ON CONFLICT') && store.has(k)) {
              const ex = store.get(k)!;
              store.set(k, { ...ex, value, updated_at });
            } else {
              store.set(k, {
                id,
                tenant_id,
                namespace,
                value,
                schema_version: 1,
                created_at,
                updated_at,
              });
            }
          } else if (s.startsWith('DELETE FROM tenant_settings')) {
            const [tenant_id, namespace] = stmt._binds as string[];
            store.delete(key(tenant_id, namespace));
          }
          return { success: true, meta: {} };
        },
        first: async <T>() => {
          if (stmt._sql.includes('WHERE tenant_id = ? AND namespace = ?')) {
            const [tenant_id, namespace] = stmt._binds as string[];
            const row = store.get(key(tenant_id, namespace));
            if (!row) return null;
            return { value: row.value } as T;
          }
          return null;
        },
        all: async <T>() => {
          if (stmt._sql.includes('WHERE tenant_id = ?')) {
            const [tenant_id] = stmt._binds as string[];
            const results: T[] = [];
            for (const row of store.values()) {
              if (row.tenant_id === tenant_id) {
                results.push({ namespace: row.namespace, value: row.value } as T);
              }
            }
            return { results };
          }
          return { results: [] };
        },
      };
      return stmt;
    },
    exec: () => Promise.resolve({ count: 0, duration: 0 }),
    batch: () => Promise.resolve([]),
    dump: () => Promise.resolve(new ArrayBuffer(0)),
  } as unknown as D1Database;

  return db;
}

// ---------------------------------------------------------------------------
// Scoring namespace tests
// ---------------------------------------------------------------------------

describe('per-tenant scoring overrides', () => {
  let db: D1Database;

  beforeEach(() => {
    db = makeD1Mock();
  });

  it('getOrDefault returns DEFAULT_SCORING when no row exists', async () => {
    const result = await getOrDefault(db, 'tenant-1', 'scoring', DEFAULT_SCORING);
    expect(result).toEqual(DEFAULT_SCORING);
  });

  it('set+get round-trips custom scoring weights', async () => {
    const custom = {
      weights: { commission: 0.5, cookieDuration: 0.3, payoutSpeed: 0.1, programAge: 0.05, approvalRate: 0.05 },
      threshold: 0.65,
    };
    await set(db, 'tenant-1', 'scoring', custom);
    const stored = await get(db, 'tenant-1', 'scoring');
    expect(stored).toEqual(custom);
  });

  it('ScoringSchema validates partial weights (all optional)', () => {
    const result = ScoringSchema.safeParse({
      weights: { commission: 0.6 }, // only one key
      threshold: 0.8,
    });
    expect(result.success).toBe(true);
  });

  it('ScoringSchema rejects weight > 1', () => {
    const result = ScoringSchema.safeParse({
      weights: { commission: 1.5 },
      threshold: 0.7,
    });
    expect(result.success).toBe(false);
  });

  it('deleteNamespace resets scoring to default on next read', async () => {
    await set(db, 'tenant-1', 'scoring', { weights: { commission: 1 }, threshold: 0.99 });
    await deleteNamespace(db, 'tenant-1', 'scoring');
    const result = await getOrDefault(db, 'tenant-1', 'scoring', DEFAULT_SCORING);
    expect(result).toEqual(DEFAULT_SCORING);
  });

  it('tenant isolation — scoring changes do not affect other tenants', async () => {
    await set(db, 'tenant-A', 'scoring', { weights: { commission: 0.9 }, threshold: 0.5 });
    const other = await get(db, 'tenant-B', 'scoring');
    expect(other).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Geo namespace tests
// ---------------------------------------------------------------------------

describe('per-tenant geo overrides', () => {
  let db: D1Database;

  beforeEach(() => {
    db = makeD1Mock();
  });

  it('getOrDefault returns DEFAULT_GEO when no row exists', async () => {
    const result = await getOrDefault(db, 'tenant-1', 'geo', DEFAULT_GEO);
    expect(result).toEqual(DEFAULT_GEO);
  });

  it('set+get round-trips additionalRules and removedRules', async () => {
    const custom = {
      additionalRules: [
        { category: 'gambling', blockedCountries: ['AU', 'NZ'], reason: 'Local law' },
      ],
      removedRules: [{ category: 'crypto', country: 'SG' }],
    };
    await set(db, 'tenant-2', 'geo', custom);
    const stored = await get(db, 'tenant-2', 'geo');
    expect(stored).toEqual(custom);
  });

  it('GeoSchema rejects invalid country code', () => {
    const result = GeoSchema.safeParse({
      additionalRules: [{ category: 'pharma', blockedCountries: ['INVALID'] }],
      removedRules: [],
    });
    expect(result.success).toBe(false);
  });

  it('GeoSchema accepts valid ISO-3166-1 alpha-2 codes', () => {
    const result = GeoSchema.safeParse({
      additionalRules: [{ category: 'pharma', blockedCountries: ['US', 'DE'] }],
      removedRules: [{ category: 'crypto', country: 'CN' }],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cron namespace tests
// ---------------------------------------------------------------------------

describe('per-tenant cron overrides', () => {
  let db: D1Database;

  beforeEach(() => {
    db = makeD1Mock();
  });

  it('getOrDefault returns DEFAULT_CRON when no row exists', async () => {
    const result = await getOrDefault(db, 'tenant-1', 'cron', DEFAULT_CRON);
    expect(result).toEqual(DEFAULT_CRON);
  });

  it('set+get round-trips custom cron settings', async () => {
    const custom = {
      affiliateScoutCadenceHours: 24,
      contentProducerCron: '0 8 * * *',
      enabled: { affiliateScout: false, contentProducer: true },
    };
    await set(db, 'tenant-3', 'cron', custom);
    const stored = await get(db, 'tenant-3', 'cron');
    expect(stored).toEqual(custom);
  });

  it('CronSchema rejects cadence < 1', () => {
    const result = CronSchema.safeParse({
      affiliateScoutCadenceHours: 0,
      contentProducerCron: '0 6 * * *',
      enabled: { affiliateScout: true, contentProducer: true },
    });
    expect(result.success).toBe(false);
  });

  it('CronSchema rejects cadence > 168', () => {
    const result = CronSchema.safeParse({
      affiliateScoutCadenceHours: 200,
      contentProducerCron: '0 6 * * *',
      enabled: { affiliateScout: true, contentProducer: true },
    });
    expect(result.success).toBe(false);
  });

  it('CronSchema accepts valid cron expression', () => {
    const result = CronSchema.safeParse({
      affiliateScoutCadenceHours: 12,
      contentProducerCron: '30 9 * * 1-5',
      enabled: { affiliateScout: true, contentProducer: false },
    });
    expect(result.success).toBe(true);
  });

  it('enabled.affiliateScout=false serialises and deserialises correctly', async () => {
    const custom = {
      affiliateScoutCadenceHours: 6,
      contentProducerCron: '0 6 * * *',
      enabled: { affiliateScout: false, contentProducer: true },
    };
    await set(db, 'tenant-4', 'cron', custom);
    const stored = await get<typeof custom>(db, 'tenant-4', 'cron');
    expect(stored?.enabled.affiliateScout).toBe(false);
    expect(stored?.enabled.contentProducer).toBe(true);
  });
});
