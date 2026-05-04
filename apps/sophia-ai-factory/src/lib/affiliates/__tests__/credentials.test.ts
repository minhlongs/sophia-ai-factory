/**
 * Unit tests for affiliate network credential storage.
 * Uses a fake D1 (in-memory Map) — no live DB needed.
 * @module lib/affiliates/__tests__/credentials.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveCredentials,
  getCredentials,
  deleteCredentials,
  listNetworks,
  validateCredentials,
} from '../credentials';

// ----- Fake D1 (in-memory) -----
function makeFakeD1() {
  const rows = new Map<string, Record<string, unknown>>();

  return {
    _rows: rows,
    prepare(sql: string) {
      let boundValues: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          boundValues = args;
          return stmt;
        },
        async run() {
          const lower = sql.toLowerCase();
          if (lower.includes('insert into affiliate_network_credentials')) {
            const [id, tenant_id, network, encrypted_credentials, , created_at, updated_at] = boundValues;
            const key = `${tenant_id as string}::${network as string}`;
            if (lower.includes('on conflict') && rows.has(key)) {
              // update on conflict
              const existing = rows.get(key)!;
              rows.set(key, { ...existing, encrypted_credentials, status: 'active', updated_at });
            } else {
              rows.set(key, { id, tenant_id, network, encrypted_credentials, status: 'active', created_at, updated_at, last_validated_at: null });
            }
          } else if (lower.includes('delete from affiliate_network_credentials')) {
            const [tenant_id, network] = boundValues;
            rows.delete(`${tenant_id as string}::${network as string}`);
          } else if (lower.includes('update affiliate_network_credentials')) {
            const [status, last_validated_at, updated_at, tenant_id, network] = boundValues;
            const key = `${tenant_id as string}::${network as string}`;
            if (rows.has(key)) {
              rows.set(key, { ...rows.get(key)!, status, last_validated_at, updated_at });
            }
          }
          return { success: true };
        },
        async first<T>() {
          const lower = sql.toLowerCase();
          if (lower.includes('select encrypted_credentials')) {
            const [tenant_id, network] = boundValues;
            return (rows.get(`${tenant_id as string}::${network as string}`) ?? null) as T | null;
          }
          return null as T | null;
        },
        async all<T>() {
          const lower = sql.toLowerCase();
          if (lower.includes('select network, status')) {
            const [tenant_id] = boundValues;
            const results = [...rows.values()]
              .filter(r => r.tenant_id === tenant_id)
              .map(r => ({ network: r.network, status: r.status, last_validated_at: r.last_validated_at }));
            return { results: results as T[] };
          }
          return { results: [] as T[] };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
}

// Stub encryptToken / decryptToken so tests don't need OAUTH_TOKEN_ENC_KEY
vi.mock('@/lib/publishing/token-crypto', () => ({
  encryptToken: (plaintext: string) => Promise.resolve(`enc::${plaintext}`),
  decryptToken: (cipher: string) => Promise.resolve(cipher.replace(/^enc::/, '')),
}));

// ----- Tests -----
describe('affiliate credentials', () => {
  let db: D1Database;
  beforeEach(() => { db = makeFakeD1(); });

  it('save then get returns the payload', async () => {
    await saveCredentials(db, 'tenant-1', 'binance', { api_key: 'BN_KEY', api_secret: 'BN_SECRET' });
    const result = await getCredentials(db, 'tenant-1', 'binance');
    expect(result).toEqual({ api_key: 'BN_KEY', api_secret: 'BN_SECRET' });
  });

  it('returns null for missing network', async () => {
    const result = await getCredentials(db, 'tenant-1', 'coinbase');
    expect(result).toBeNull();
  });

  it('upsert overwrites previous credentials', async () => {
    await saveCredentials(db, 'tenant-1', 'bybit', { api_key: 'OLD', api_secret: 'OLD_S' });
    await saveCredentials(db, 'tenant-1', 'bybit', { api_key: 'NEW', api_secret: 'NEW_S' });
    const result = await getCredentials(db, 'tenant-1', 'bybit');
    expect(result?.api_key).toBe('NEW');
  });

  it('delete removes credentials', async () => {
    await saveCredentials(db, 'tenant-1', 'partnerstack', { api_key: 'PS_KEY' });
    await deleteCredentials(db, 'tenant-1', 'partnerstack');
    const result = await getCredentials(db, 'tenant-1', 'partnerstack');
    expect(result).toBeNull();
  });

  it('listNetworks returns only tenant-scoped rows', async () => {
    await saveCredentials(db, 'tenant-A', 'cj', { api_key: 'CJ1' });
    await saveCredentials(db, 'tenant-B', 'cj', { api_key: 'CJ2' });
    const list = await listNetworks(db, 'tenant-A');
    expect(list).toHaveLength(1);
    expect(list[0].network).toBe('cj');
  });

  it('listNetworks returns empty for unknown tenant', async () => {
    const list = await listNetworks(db, 'nobody');
    expect(list).toHaveLength(0);
  });

  it('validateCredentials returns invalid when no creds stored', async () => {
    const result = await validateCredentials(db, 'tenant-1', 'impact_radius');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/No credentials/);
  });

  it('validateCredentials marks invalid on probe failure', async () => {
    // Store fake creds — probe will hit a network we mock to fail
    await saveCredentials(db, 'tenant-1', 'coinbase', { api_key: 'BAD', api_secret: 'BAD' });
    // Mock fetch to return 401
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 401 }),
    );
    const result = await validateCredentials(db, 'tenant-1', 'coinbase');
    expect(result.valid).toBe(false);
    fetchSpy.mockRestore();
  });
});
