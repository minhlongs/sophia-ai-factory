import { describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@/seed/db/client';
import { countActiveOrgMembers, countPendingOrgInvites } from './seat-quota-queries';

type CountRow = { count: number } | null;

function database(...results: Array<CountRow | Error>): D1Database {
  const first = vi.fn(async () => {
    const result = results.shift();
    if (result instanceof Error) throw result;
    return result;
  });
  const statement: { bind: ReturnType<typeof vi.fn>; first: typeof first } = {
    bind: vi.fn(),
    first,
  };
  statement.bind.mockReturnValue(statement);
  return { prepare: vi.fn(() => statement) } as unknown as D1Database;
}

describe('seat quota compatibility queries', () => {
  it('uses current member rows first and falls back to legacy rows when empty', async () => {
    await expect(countActiveOrgMembers(database({ count: 4 }), 'org-1')).resolves.toBe(4);
    await expect(countActiveOrgMembers(database({ count: 0 }, { count: 3 }), 'org-1')).resolves.toBe(3);
    await expect(countActiveOrgMembers(database(null, null), 'org-1')).resolves.toBe(0);
  });

  it('recovers from missing member tables and safely returns zero when both queries fail', async () => {
    await expect(countActiveOrgMembers(database(new Error('missing table'), { count: 2 }), 'org-1')).resolves.toBe(2);
    await expect(countActiveOrgMembers(database(new Error('missing table'), new Error('legacy missing')), 'org-1')).resolves.toBe(0);
    await expect(countActiveOrgMembers(database({ count: 0 }, new Error('legacy missing')), 'org-1')).resolves.toBe(0);
  });

  it('counts pending invites, then checks legacy invitation storage when needed', async () => {
    await expect(countPendingOrgInvites(database({ count: 5 }), 'org-1', 100)).resolves.toBe(5);
    await expect(countPendingOrgInvites(database({ count: 0 }, { count: 2 }), 'org-1', 100)).resolves.toBe(2);
    await expect(countPendingOrgInvites(database(null, null), 'org-1', 100)).resolves.toBe(0);
    await expect(countPendingOrgInvites(database(new Error('missing table'), { count: 1 }), 'org-1', 100)).resolves.toBe(1);
    await expect(countPendingOrgInvites(database(new Error('missing table'), new Error('legacy missing')), 'org-1', 100)).resolves.toBe(0);
    await expect(countPendingOrgInvites(database({ count: 0 }, new Error('legacy missing')), 'org-1', 100)).resolves.toBe(0);
  });
});
