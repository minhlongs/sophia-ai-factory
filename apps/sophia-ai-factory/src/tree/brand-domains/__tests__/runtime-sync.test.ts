import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getEffectiveAllowedHosts,
  registerDynamicActiveHosts,
  resetDynamicHostRegistryForTests,
} from '@/seed/domain';
import { syncActiveBrandDomainsFromD1 } from '@/tree/brand-domains/runtime-sync';

const getD1Mock = vi.hoisted(() => vi.fn());
vi.mock('@/seed/db/client', () => ({
  getD1: getD1Mock,
}));

function makeDbWithHosts(hosts: string[]): D1Database {
  return {
    prepare() {
      return {
        bind() {
          return {
            async all() {
              return { results: hosts.map((hostname) => ({ hostname })) };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe('tree/brand-domains — runtime D1 synchronization', () => {
  beforeEach(() => {
    resetDynamicHostRegistryForTests();
    getD1Mock.mockReset();
  });

  it('loads active brand domains from D1 into seed allowlist cache', async () => {
    const db = makeDbWithHosts(['app.brand-one.io', 'studio.brand-two.io']);
    const loaded = await syncActiveBrandDomainsFromD1({
      db,
      env: { NODE_ENV: 'production' },
    });

    expect(loaded).toEqual(['app.brand-one.io', 'studio.brand-two.io']);
    const allowed = getEffectiveAllowedHosts({ NODE_ENV: 'production' });
    expect(allowed.has('app.brand-one.io')).toBe(true);
    expect(allowed.has('studio.brand-two.io')).toBe(true);
  });

  it('short-circuits when cache is fresh unless force=true is passed', async () => {
    registerDynamicActiveHosts(['cached.brand.io'], 60_000);
    const db = makeDbWithHosts(['fresh.brand.io']);

    const skipped = await syncActiveBrandDomainsFromD1({ db });
    expect(skipped).toEqual([]);
    expect(getEffectiveAllowedHosts({ NODE_ENV: 'production' }).has('cached.brand.io')).toBe(true);

    const forced = await syncActiveBrandDomainsFromD1({ db, force: true });
    expect(forced).toEqual(['fresh.brand.io']);
    expect(getEffectiveAllowedHosts({ NODE_ENV: 'production' }).has('fresh.brand.io')).toBe(true);
    expect(getEffectiveAllowedHosts({ NODE_ENV: 'production' }).has('cached.brand.io')).toBe(false);
  });

  it('fails safe when D1 binding is null or throws an error', async () => {
    getD1Mock.mockResolvedValueOnce(null);
    expect(await syncActiveBrandDomainsFromD1()).toEqual([]);

    const failingDb = {
      prepare() {
        throw new Error('no such table: brand_domains');
      },
    } as unknown as D1Database;
    expect(await syncActiveBrandDomainsFromD1({ db: failingDb, force: true })).toEqual([]);
  });
});
