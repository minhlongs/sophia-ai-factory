/**
 * Tests for with-tenant-scope.ts
 *
 * Covers:
 * - Tenant A query on video_jobs returns 0 rows from tenant B's data
 * - Insert without tenant_id throws
 * - Insert with mismatched tenant_id throws
 * - Bypass tables (users) are not filtered
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withTenantScope, TENANT_SCOPED_TABLES, TenantScopedClient } from '@/seed/db/with-tenant-scope';
import type { D1Client } from '@/seed/db/d1-client-rpc';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeChain(rows: Record<string, unknown>[] = []) {
  const eqFilters: Array<{ col: string; val: unknown }> = [];

  const chain = {
    _filters: eqFilters,
    eq: vi.fn(function(col: string, val: unknown) {
      eqFilters.push({ col, val });
      return chain;
    }),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows.filter(r => {
        return eqFilters.every(f => r[f.col] === f.val);
      }), error: null }).then(resolve),
  };
  return chain;
}

function makeD1Client(allRows: Record<string, unknown>[] = []): D1Client {
  return {
    from: vi.fn((_table: string) => makeChain(allRows)),
    rpc: vi.fn(),
  } as unknown as D1Client;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('withTenantScope', () => {
  it('throws if tenantId is empty', () => {
    const client = makeD1Client();
    expect(() => withTenantScope(client, '')).toThrow('[withTenantScope] tenantId must be a non-empty string');
  });

  it('returns a TenantScopedClient', () => {
    const client = makeD1Client();
    const scoped = withTenantScope(client, 'tenant-a');
    expect(scoped).toBeInstanceOf(TenantScopedClient);
  });

  describe('from() — scoped tables', () => {
    it('auto-injects eq(tenant_id) for video_jobs', () => {
      const client = makeD1Client();
      const scoped = withTenantScope(client, 'tenant-a');
      const chain = scoped.from('video_jobs');
      // chain.eq was called with tenant_id
      expect(chain.eq).toHaveBeenCalledWith('tenant_id', 'tenant-a');
    });

    it('tenant A sees only its own rows — not tenant B data', async () => {
      const tenantARows = [
        { id: '1', tenant_id: 'tenant-a', prompt: 'hello' },
        { id: '2', tenant_id: 'tenant-a', prompt: 'world' },
      ];
      const tenantBRows = [
        { id: '3', tenant_id: 'tenant-b', prompt: 'secret' },
      ];
      const allRows = [...tenantARows, ...tenantBRows];

      const client = makeD1Client(allRows);
      const scopedA = withTenantScope(client, 'tenant-a');

      const chain = scopedA.from('video_jobs').select('*');
      const { data } = await chain;

      expect(data).toHaveLength(2);
      expect(data?.every(r => r.tenant_id === 'tenant-a')).toBe(true);
      expect(data?.find(r => r.tenant_id === 'tenant-b')).toBeUndefined();
    });

    it('returns 0 rows for tenant B when querying as tenant A', async () => {
      const allRows = [
        { id: '1', tenant_id: 'tenant-b', prompt: 'secret' },
        { id: '2', tenant_id: 'tenant-b', prompt: 'also secret' },
      ];

      const client = makeD1Client(allRows);
      const scopedA = withTenantScope(client, 'tenant-a');

      const { data } = await scopedA.from('video_jobs').select('*');
      expect(data).toHaveLength(0);
    });

    it('TENANT_SCOPED_TABLES includes all required tables', () => {
      const required = ['video_jobs', 'video_cost_log', 'voices', 'video_templates', 'tenant_storage_usage'];
      for (const t of required) {
        expect(TENANT_SCOPED_TABLES.has(t as never)).toBe(true);
      }
    });
  });

  describe('from() — bypass tables', () => {
    it('does NOT inject tenant_id for users table', () => {
      const client = makeD1Client();
      const scoped = withTenantScope(client, 'tenant-a');
      const chain = scoped.from('users');
      // eq should NOT have been called with tenant_id
      const calls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
      const tenantCalls = calls.filter(([col]) => col === 'tenant_id');
      expect(tenantCalls).toHaveLength(0);
    });

    it('does NOT inject tenant_id for sessions table', () => {
      const client = makeD1Client();
      const scoped = withTenantScope(client, 'tenant-a');
      const chain = scoped.from('sessions');
      const calls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.filter(([col]) => col === 'tenant_id')).toHaveLength(0);
    });
  });

  describe('insertScoped()', () => {
    it('throws if tenant_id is missing from insert data', () => {
      const client = makeD1Client();
      const scoped = withTenantScope(client, 'tenant-a');
      expect(() => scoped.insertScoped('video_jobs', { prompt: 'test' })).toThrow(
        /requires tenant_id/
      );
    });

    it('throws if tenant_id does not match scoped tenant', () => {
      const client = makeD1Client();
      const scoped = withTenantScope(client, 'tenant-a');
      expect(() =>
        scoped.insertScoped('video_jobs', { tenant_id: 'tenant-b', prompt: 'test' })
      ).toThrow(/tenant_id mismatch/);
    });

    it('succeeds with correct tenant_id', () => {
      const client = makeD1Client();
      const scoped = withTenantScope(client, 'tenant-a');
      expect(() =>
        scoped.insertScoped('video_jobs', { tenant_id: 'tenant-a', prompt: 'test' })
      ).not.toThrow();
    });
  });
});
