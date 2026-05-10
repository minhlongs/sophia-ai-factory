/**
 * Tests for cascadeDeleteAccount (Wave 22 Phase 06).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  cascadeDeleteAccount,
  ACCOUNT_DELETE_ORDER,
} from '../cascade-delete';

interface SqlCall {
  sql: string;
  binds: unknown[];
}

function makeDb(opts: { rowsPerTable?: Record<string, number>; throwOn?: string } = {}) {
  const calls: SqlCall[] = [];
  const db = {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockImplementation((...binds: unknown[]) => {
        calls.push({ sql, binds });
        return {
          run: vi.fn().mockImplementation(() => {
            for (const t of ACCOUNT_DELETE_ORDER) {
              if (sql.includes(`FROM ${t}`)) {
                if (opts.throwOn === t) return Promise.reject(new Error(`fail-${t}`));
                return Promise.resolve({
                  meta: { rows_written: opts.rowsPerTable?.[t] ?? 0 },
                });
              }
            }
            // account_deletion_requests cleanup
            return Promise.resolve({ meta: { rows_written: 1 } });
          }),
        };
      }),
    })),
  };
  return { db: db as unknown as D1Database, calls };
}

describe('cascadeDeleteAccount', () => {
  it('issues a DELETE for every table in ACCOUNT_DELETE_ORDER', async () => {
    const { db, calls } = makeDb();
    const res = await cascadeDeleteAccount(db, 'user-1', 'tenant-1');

    for (const table of ACCOUNT_DELETE_ORDER) {
      expect(calls.some((c) => c.sql.includes(`FROM ${table}`) && c.binds[0] === 'tenant-1')).toBe(
        true,
      );
    }
    expect(Object.keys(res.byTable)).toEqual([...ACCOUNT_DELETE_ORDER]);
  });

  it('sums rows_written across tables into totalDeleted', async () => {
    const { db } = makeDb({
      rowsPerTable: {
        audit_log: 3,
        publishing_results: 5,
        users: 1,
      },
    });
    const res = await cascadeDeleteAccount(db, 'user-1', 'tenant-1');
    expect(res.totalDeleted).toBe(9);
    expect(res.byTable.audit_log).toBe(3);
    expect(res.byTable.publishing_results).toBe(5);
    expect(res.byTable.users).toBe(1);
  });

  it('returns 0 for table when DELETE throws (idempotent failure)', async () => {
    const { db } = makeDb({ throwOn: 'sessions', rowsPerTable: { users: 1 } });
    const res = await cascadeDeleteAccount(db, 'user-1', 'tenant-1');
    expect(res.byTable.sessions).toBe(0);
    expect(res.byTable.users).toBe(1);
  });

  it('cleans up account_deletion_requests row by user_id', async () => {
    const { db, calls } = makeDb();
    await cascadeDeleteAccount(db, 'user-9', 'tenant-9');
    expect(
      calls.some(
        (c) =>
          c.sql.includes('FROM account_deletion_requests') && c.binds[0] === 'user-9',
      ),
    ).toBe(true);
  });

  it('is idempotent when run twice on already-deleted tenant', async () => {
    const { db } = makeDb({ rowsPerTable: {} });
    const a = await cascadeDeleteAccount(db, 'user-1', 'tenant-1');
    const b = await cascadeDeleteAccount(db, 'user-1', 'tenant-1');
    expect(a.totalDeleted).toBe(0);
    expect(b.totalDeleted).toBe(0);
  });
});
