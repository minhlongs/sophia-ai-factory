/**
 * Unit tests for ad network credential storage.
 * Uses a fake D1 (in-memory Map) — no live DB needed.
 * @module land/adsense/__tests__/credentials.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  storeAdNetworkCredentials,
  getAdNetworkCredentials,
  deleteAdNetworkCredentials,
  listAdNetworks,
} from '../credentials';

// ----- Fake D1 (in-memory) -----
function createFakeD1() {
  const store = new Map<string, Record<string, string>>();
  const orgMembers = new Map<string, Set<string>>();
  orgMembers.set('ws-1', new Set(['user-1']));
  orgMembers.set('ws-2', new Set(['user-2']));

  const state = {
    lastSql: '',
    lastBind: [] as unknown[],
  };

  function doFirst(): Promise<Record<string, unknown> | null> {
    const { lastSql: sql, lastBind: bind } = state;
    if (sql.includes('org_members')) {
      const orgId = bind[0] as string;
      const userId = bind[1] as string;
      const members = orgMembers.get(orgId);
      return Promise.resolve(members?.has(userId) ? { _ok: true } : null);
    }
    const key = `${bind[0] as string}::${bind[1] as string}`;
    const row = store.get(key);
    return Promise.resolve(row ? { encrypted_credentials: row.encrypted_credentials } : null);
  }

  function doAll(): Promise<{ results: { network: string }[] }> {
    const tenantId = state.lastBind[0] as string;
    const results: { network: string }[] = [];
    for (const [key, val] of store) {
      if (key.startsWith(`${tenantId}::`) && val.network) {
        results.push({ network: val.network });
      }
    }
    return Promise.resolve({ results });
  }

  function doRun(): Promise<{ success: boolean }> {
    const { lastSql: sql, lastBind: bind } = state;
    if (sql.includes('INSERT')) {
      const tenantId = bind[1] as string;
      const network = bind[2] as string;
      const key = `${tenantId}::${network}`;
      store.set(key, {
        encrypted_credentials: bind[3] as string,
        network,
      });
    } else if (sql.includes('DELETE')) {
      const tenantId = bind[0] as string;
      const network = bind[1] as string;
      store.delete(`${tenantId}::${network}`);
    }
    return Promise.resolve({ success: true });
  }

  const db = {
    prepare(sql: string) {
      state.lastSql = sql;
      state.lastBind = [];
      return {
        bind(...args: unknown[]) {
          state.lastBind = args;
          return {
            first: () => doFirst(),
            all: () => doAll(),
            run: () => doRun(),
          };
        },
      };
    },
  } as unknown as D1Database;

  return { db, store, orgMembers };
}

// ----- Mock crypto -----
const fakeEncryptedPrefix = 'ENC:';

vi.mock('@/tree/crypto/token-crypto', () => ({
  encryptToken: vi.fn(async (plaintext: string) => `${fakeEncryptedPrefix}${plaintext}`),
  decryptToken: vi.fn(async (ciphertext: string) => {
    if (!ciphertext.startsWith(fakeEncryptedPrefix)) throw new Error('bad ciphertext');
    return ciphertext.slice(fakeEncryptedPrefix.length);
  }),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe('ad network credentials', () => {
  let fakeD1: ReturnType<typeof createFakeD1>;

  beforeEach(() => {
    fakeD1 = createFakeD1();
  });

  it('round-trip: store then get returns decrypted values', async () => {
    const storeResult = await storeAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'google_adsense', 'key-123', 'partner-abc',
    );
    expect(storeResult.ok).toBe(true);

    const getResult = await getAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'google_adsense',
    );
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.value).not.toBeNull();
      expect(getResult.value!.apiKey).toBe('key-123');
      expect(getResult.value!.partnerId).toBe('partner-abc');
      expect(getResult.value!.network).toBe('google_adsense');
    }
  });

  it('round-trip with additionalConfig', async () => {
    const storeResult = await storeAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'youtube_partner',
      'yt-key', 'yt-partner', { channel_id: 'UC123' },
    );
    expect(storeResult.ok).toBe(true);

    const getResult = await getAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'youtube_partner',
    );
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.value!.additionalConfig?.channel_id).toBe('UC123');
    }
  });

  it('tenant isolation: workspace A cannot read workspace B credentials', async () => {
    await storeAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'google_adsense', 'secret-key', 'p1',
    );

    const getResult = await getAdNetworkCredentials(
      fakeD1.db, 'user-2', 'ws-2', 'google_adsense',
    );
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.value).toBeNull();
    }
  });

  it('delete then get returns null', async () => {
    await storeAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'google_adsense', 'k', 'p',
    );
    const delResult = await deleteAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'google_adsense',
    );
    expect(delResult.ok).toBe(true);

    const getResult = await getAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'google_adsense',
    );
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.value).toBeNull();
    }
  });

  it('unsupported network returns failure', async () => {
    const result = await storeAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1',
      'unsupported_network' as unknown as 'google_adsense',
      'k', 'p',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/Unsupported/);
    }
  });

  it('unauthorized user cannot store credentials', async () => {
    const result = await storeAdNetworkCredentials(
      fakeD1.db, 'attacker', 'ws-1', 'google_adsense', 'k', 'p',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/Not authorized/);
    }
  });

  it('listAdNetworks returns only stored ad networks', async () => {
    await storeAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'google_adsense', 'k1', 'p1',
    );
    await storeAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'youtube_partner', 'k2', 'p2',
    );
    const result = await listAdNetworks(fakeD1.db, 'user-1', 'ws-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('google_adsense');
      expect(result.value).toContain('youtube_partner');
      expect(result.value).toHaveLength(2);
    }
  });

  it('upsert: storing same network twice updates credentials', async () => {
    await storeAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'google_adsense', 'old-key', 'old-p',
    );
    await storeAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'google_adsense', 'new-key', 'new-p',
    );
    const result = await getAdNetworkCredentials(
      fakeD1.db, 'user-1', 'ws-1', 'google_adsense',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value!.apiKey).toBe('new-key');
      expect(result.value!.partnerId).toBe('new-p');
    }
  });
});
