/**
 * Tests for audit-log search primitive — D1 mocked.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchAuditLog, getTopActions } from './audit-log-stats';

interface RawRow {
  id: number;
  tenant_id: string;
  actor: string;
  action: string;
  resource: string | null;
  metadata_json: string | null;
  ts: number;
}

function setD1Mock(opts: {
  rows?: RawRow[];
  topActions?: Array<{ action: string; n: number }>;
  sqlCapture?: (q: string) => void;
  bindCapture?: (...args: unknown[]) => void;
}) {
  const all = vi.fn().mockImplementation(() => {
    if (opts.topActions) {
      return Promise.resolve({ results: opts.topActions, success: true });
    }
    return Promise.resolve({ results: opts.rows ?? [], success: true });
  });
  const bind = vi.fn().mockImplementation((...args: unknown[]) => {
    opts.bindCapture?.(...args);
    return { all };
  });
  const prepare = vi.fn().mockImplementation((q: string) => {
    opts.sqlCapture?.(q);
    return { bind };
  });
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
    ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
    DB: { prepare },
  };
}

afterEach(() => vi.clearAllMocks());

describe('searchAuditLog', () => {
  it('returns empty array when no rows', async () => {
    setD1Mock({});
    const result = await searchAuditLog({});
    expect(result).toEqual([]);
  });

  it('maps rows with parsed metadata JSON', async () => {
    setD1Mock({
      rows: [
        {
          id: 1,
          tenant_id: 't-1',
          actor: 'admin@x.com',
          action: 'video.publish',
          resource: 'video:abc',
          metadata_json: '{"size":42,"region":"us-east"}',
          ts: 1700000000,
        },
      ],
    });
    const result = await searchAuditLog({});
    expect(result).toHaveLength(1);
    expect(result[0].metadata).toEqual({ size: 42, region: 'us-east' });
  });

  it('survives malformed metadata_json with metadata=null', async () => {
    setD1Mock({
      rows: [
        {
          id: 2, tenant_id: 't', actor: 'u', action: 'a',
          resource: null, metadata_json: 'not-json{{', ts: 1,
        },
      ],
    });
    const result = await searchAuditLog({});
    expect(result[0].metadata).toBeNull();
  });

  it('clamps limit to [1, 500] and floors fractional', async () => {
    const bound: unknown[][] = [];
    setD1Mock({ bindCapture: (...args) => bound.push(args) });

    await searchAuditLog({ limit: 9999 });
    expect(bound[0][0]).toBe(500);

    bound.length = 0;
    await searchAuditLog({ limit: 0 });
    expect(bound[0][0]).toBe(1);

    bound.length = 0;
    await searchAuditLog({ limit: 25.7 });
    expect(bound[0][0]).toBe(25);
  });

  it('clamps offset to >= 0', async () => {
    const bound: unknown[][] = [];
    setD1Mock({ bindCapture: (...args) => bound.push(args) });
    await searchAuditLog({ offset: -50 });
    expect(bound[0][1]).toBe(0);
  });

  it('builds WHERE clause from filters', async () => {
    let lastSql = '';
    setD1Mock({ sqlCapture: (q) => { lastSql = q; } });
    await searchAuditLog({ tenantId: 't', action: 'login', fromTs: 0, toTs: 100 });
    expect(lastSql).toMatch(/tenant_id = \?/);
    expect(lastSql).toMatch(/action = \?/);
    expect(lastSql).toMatch(/ts >= \?/);
    expect(lastSql).toMatch(/ts <= \?/);
  });

  it('omits WHERE clause when no filters supplied', async () => {
    let lastSql = '';
    setD1Mock({ sqlCapture: (q) => { lastSql = q; } });
    await searchAuditLog({});
    expect(lastSql).not.toMatch(/WHERE/);
  });

  it('binds filters in declaration order', async () => {
    const bound: unknown[][] = [];
    setD1Mock({ bindCapture: (...args) => bound.push(args) });
    await searchAuditLog({ tenantId: 't1', action: 'a1', fromTs: 100, toTs: 200, limit: 10, offset: 5 });
    expect(bound[0]).toEqual(['t1', 'a1', 100, 200, 10, 5]);
  });
});

describe('getTopActions', () => {
  it('returns ordered action frequencies', async () => {
    setD1Mock({
      topActions: [
        { action: 'login', n: 45 },
        { action: 'video.publish', n: 12 },
      ],
    });
    const result = await getTopActions(0, 1000);
    expect(result).toEqual([
      { action: 'login', count: 45 },
      { action: 'video.publish', count: 12 },
    ]);
  });

  it('clamps limit to [1, 100]', async () => {
    const bound: unknown[][] = [];
    setD1Mock({ topActions: [], bindCapture: (...args) => bound.push(args) });
    await getTopActions(0, 1000, 9999);
    expect(bound[0][2]).toBe(100);
  });
});
