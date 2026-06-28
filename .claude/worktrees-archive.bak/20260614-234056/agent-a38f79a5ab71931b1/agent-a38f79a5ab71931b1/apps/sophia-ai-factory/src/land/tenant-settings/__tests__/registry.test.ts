/**
 * Unit tests for tenant-settings registry.
 * Uses an in-memory D1 mock — no real DB required.
 * @module lib/tenant-settings/__tests__/registry.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as registry from '../registry';
import { SettingsValidationError } from '../types';
import type { SettingsNamespace } from '../types';

// ---------- lightweight D1 mock ----------

type Row = { id: string; tenant_id: string; namespace: string; value: string; schema_version: number; created_at: string; updated_at: string };

function makeD1Mock(): D1Database {
  const store: Map<string, Row> = new Map(); // key: `${tenant_id}::${namespace}`

  function rowKey(tenantId: string, ns: string) {
    return `${tenantId}::${ns}`;
  }

  const db = {
    prepare: (sql: string) => {
      const stmt = {
        _sql: sql,
        _binds: [] as unknown[],
        bind: (...args: unknown[]) => { stmt._binds = args; return stmt; },
        run: async () => {
          const s = stmt._sql.trim();
          if (s.startsWith('INSERT INTO tenant_settings')) {
            const [id, tenant_id, namespace, value, , created_at, updated_at] = stmt._binds as string[];
            const k = rowKey(tenant_id, namespace);
            if (s.includes('ON CONFLICT') && store.has(k)) {
              const existing = store.get(k)!;
              store.set(k, { ...existing, value, updated_at });
            } else {
              store.set(k, { id, tenant_id, namespace, value, schema_version: 1, created_at, updated_at });
            }
          } else if (s.startsWith('DELETE FROM tenant_settings')) {
            const [tenant_id, namespace] = stmt._binds as string[];
            store.delete(rowKey(tenant_id, namespace));
          }
          return { success: true, meta: {} };
        },
        first: async <T>() => {
          const s = stmt._sql.trim();
          if (s.includes('WHERE tenant_id = ? AND namespace = ?')) {
            const [tenant_id, namespace] = stmt._binds as string[];
            const row = store.get(rowKey(tenant_id, namespace));
            if (!row) return null;
            return { value: row.value } as T;
          }
          return null;
        },
        all: async <T>() => {
          const s = stmt._sql.trim();
          if (s.includes('WHERE tenant_id = ?')) {
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
    exec: vi.fn(),
    batch: vi.fn(),
    dump: vi.fn(),
  } as unknown as D1Database;

  return db;
}

// ---------- tests ----------

describe('registry', () => {
  let db: D1Database;
  const tenant = 'tenant-abc';
  const ns: SettingsNamespace = 'branding';

  beforeEach(() => {
    db = makeD1Mock();
  });

  it('get returns null when no row exists', async () => {
    const result = await registry.get(db, tenant, ns);
    expect(result).toBeNull();
  });

  it('set then get round-trips the value', async () => {
    const val = { logoUrl: null, primaryColor: '#7c3aed', welcomeMessage: null, customDomain: null };
    await registry.set(db, tenant, ns, val);
    const result = await registry.get(db, tenant, ns);
    expect(result).toEqual(val);
  });

  it('deleteNamespace removes the row', async () => {
    await registry.set(db, tenant, ns, { foo: 'bar' });
    await registry.deleteNamespace(db, tenant, ns);
    const result = await registry.get(db, tenant, ns);
    expect(result).toBeNull();
  });

  it('getOrDefault returns default value when row is absent', async () => {
    const defaultVal = { primaryColor: '#ff0000' };
    const result = await registry.getOrDefault(db, tenant, ns, defaultVal);
    expect(result).toEqual(defaultVal);
  });

  it('getOrDefault returns stored value when row is present', async () => {
    const stored = { logoUrl: 'https://example.com/logo.png', primaryColor: '#000' };
    await registry.set(db, tenant, ns, stored);
    const result = await registry.getOrDefault(db, tenant, ns, { primaryColor: '#fff' });
    expect(result).toEqual(stored);
  });

  it('tenant isolation — cross-tenant get returns null', async () => {
    await registry.set(db, tenant, ns, { primaryColor: '#111' });
    const other = await registry.get(db, 'tenant-xyz', ns);
    expect(other).toBeNull();
  });

  it('merge does shallow merge with existing value', async () => {
    await registry.set(db, tenant, 'misc', { a: 1, b: 2 });
    const result = await registry.merge(db, tenant, 'misc', { b: 99, c: 3 });
    expect(result).toEqual({ a: 1, b: 99, c: 3 });
  });

  it('bulkExport then bulkImport round-trips all namespaces', async () => {
    await registry.set(db, tenant, 'branding', { primaryColor: '#abc' });
    await registry.set(db, tenant, 'cron', { affiliateScoutCadenceHours: 8, contentProducerCron: '0 * * * *' });

    const exported = await registry.bulkExport(db, tenant);
    expect(exported.branding).toEqual({ primaryColor: '#abc' });
    expect(exported.cron).toEqual({ affiliateScoutCadenceHours: 8, contentProducerCron: '0 * * * *' });

    // import into a fresh db
    const db2 = makeD1Mock();
    await registry.bulkImport(db2, 'tenant-2', exported as Record<SettingsNamespace, unknown>);
    const restored = await registry.get<{ primaryColor: string }>(db2, 'tenant-2', 'branding');
    expect(restored?.primaryColor).toBe('#abc');
  });

  it('set with validator throws SettingsValidationError on rejection', async () => {
    const badValidator = (v: unknown) => {
      void v;
      throw new Error('invalid shape');
    };
    await expect(
      registry.set(db, tenant, ns, { bad: 'data' }, badValidator),
    ).rejects.toBeInstanceOf(SettingsValidationError);
  });

  it('listAll returns only present namespaces (not all possible)', async () => {
    await registry.set(db, tenant, 'scoring', { weights: {}, threshold: 0.5 });
    const all = await registry.listAll(db, tenant);
    expect(Object.keys(all)).toHaveLength(1);
    expect(Object.keys(all)[0]).toBe('scoring');
  });
});
