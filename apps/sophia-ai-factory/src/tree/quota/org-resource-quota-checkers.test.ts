import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { getOrgQuota } from '@/seed/config/tiers/org-quota-multiplier';
import type { Tier } from '@/seed/types';

const dbMock = vi.hoisted(() => ({
  results: [] as unknown[],
  queries: [] as Array<{ table: string; filters: Array<[string, unknown]> }>,
  from: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ from: dbMock.from }),
}));

import { checkApiKeyQuota, checkCredentialQuota, checkWebhookQuota } from './org-resource-quota-checkers';

function rows(count: number, make: (index: number) => Record<string, unknown>): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => make(index));
}

describe('organization resource quota checkers', () => {
  beforeEach(() => {
    dbMock.results.length = 0;
    dbMock.queries.length = 0;
    dbMock.from.mockReset();
    dbMock.from.mockImplementation((table: string) => {
      const result = dbMock.results.shift() ?? null;
      const query = { table, filters: [] as Array<[string, unknown]> };
      dbMock.queries.push(query);
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          query.filters.push([column, value]);
          return builder;
        }),
        then: (resolve: (value: { data: unknown }) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve({ data: result }).then(resolve, reject),
      };
      return builder;
    });
  });

  it('checks individual credential usage against the tier install limit, including the boundary', async () => {
    const tier: Tier = 'BASIC';
    const limit = UNIFIED_TIERS[tier].sopInstallLimit;
    dbMock.results.push(rows(limit, () => ({ user_id: 'user-1' })));

    await expect(checkCredentialQuota('user-1', null, tier)).resolves.toEqual({
      allowed: false, current: limit, limit,
    });
    expect(dbMock.queries).toEqual([{ table: 'user_provider_credentials', filters: [['user_id', 'user-1']] }]);
  });

  it('allows empty org credential quotas and counts only credentials owned by org members', async () => {
    dbMock.results.push(null);
    await expect(checkCredentialQuota('owner', 'org-empty', 'BASIC')).resolves.toEqual({
      allowed: true, current: 0, limit: getOrgQuota('BASIC').credentials,
    });

    dbMock.results.push(
      [{ user_id: 'member-a' }, { user_id: 'member-b' }],
      [{ user_id: 'member-a' }, { user_id: 'member-a' }, { user_id: 'outside-org' }],
    );
    await expect(checkCredentialQuota('owner', 'org-1', 'BASIC')).resolves.toEqual({
      allowed: false, current: 2, limit: getOrgQuota('BASIC').credentials,
    });
    expect(dbMock.queries.slice(1).map(({ table }) => table)).toEqual([
      'org_members', 'user_provider_credentials',
    ]);
  });

  it('uses the user tenant and tier webhook allowance outside an organization', async () => {
    const tier: Tier = 'PREMIUM';
    dbMock.results.push([{ id: 'webhook-1' }, { id: 'webhook-2' }]);
    const limit = UNIFIED_TIERS[tier].webhooks ? 5 : 0;

    await expect(checkWebhookQuota('user-1', null, tier)).resolves.toEqual({
      allowed: 2 < limit, current: 2, limit,
    });
    expect(dbMock.queries).toEqual([{ table: 'webhook_endpoints', filters: [['tenant_id', 'user-1']] }]);
  });

  it('uses the org webhook quota and denies requests at the limit', async () => {
    const tier: Tier = 'BASIC';
    const limit = getOrgQuota(tier).webhooks;
    dbMock.results.push(rows(limit, (index) => ({ id: `webhook-${index}` })));

    await expect(checkWebhookQuota('owner', 'org-1', tier)).resolves.toEqual({
      allowed: false, current: limit, limit,
    });
    expect(dbMock.queries[0]).toEqual({ table: 'webhook_endpoints', filters: [['tenant_id', 'org-1']] });
  });

  it('filters revoked individual API keys and counts null query results as zero', async () => {
    const tier: Tier = 'BASIC';
    const limit = getOrgQuota(tier).apiKeys;
    dbMock.results.push(rows(limit, (index) => ({ id: `key-${index}` })));

    await expect(checkApiKeyQuota('user-1', null, tier)).resolves.toEqual({
      allowed: false, current: limit, limit,
    });
    expect(dbMock.queries[0]).toEqual({
      table: 'raas_licenses', filters: [['user_id', 'user-1'], ['is_revoked', 0]],
    });

    dbMock.results.push(null);
    await expect(checkApiKeyQuota('user-2', null, tier)).resolves.toEqual({
      allowed: true, current: 0, limit,
    });
  });

  it('allows empty org API key quotas and scopes active keys to member ids', async () => {
    dbMock.results.push([]);
    await expect(checkApiKeyQuota('owner', 'org-empty', 'PREMIUM')).resolves.toEqual({
      allowed: true, current: 0, limit: getOrgQuota('PREMIUM').apiKeys,
    });

    dbMock.results.push(
      [{ user_id: 'member-a' }, { user_id: 'member-b' }],
      [{ user_id: 'member-a' }, { user_id: 'outside-org' }, { user_id: 'member-b' }],
    );
    await expect(checkApiKeyQuota('owner', 'org-1', 'PREMIUM')).resolves.toEqual({
      allowed: true, current: 2, limit: getOrgQuota('PREMIUM').apiKeys,
    });
    expect(dbMock.queries.slice(-2)).toEqual([
      { table: 'org_members', filters: [['org_id', 'org-1']] },
      { table: 'raas_licenses', filters: [['is_revoked', 0]] },
    ]);
  });
});
