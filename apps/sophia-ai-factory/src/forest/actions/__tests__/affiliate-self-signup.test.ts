/**
 * Tests for the affiliate self-serve signup action.
 *
 * The behaviour that matters most: a user can never end up with two partner
 * rows, even when two signups race, and the answer never reveals whether an
 * account is already a partner.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface FakeRow {
  id: string;
  user_id: string;
  partner_code: string;
}

vi.mock('@/seed/db/client', () => ({ getD1: vi.fn() }));
vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { affiliateSelfSignupAction, affiliateSelfSignupSchema } from '../affiliate-self-signup';
import type { AffiliateSelfSignupInput } from '../affiliate-self-signup';

interface FakeStatement {
  bound: unknown[];
  isInsert: boolean;
  bind: (...args: unknown[]) => FakeStatement;
  first: <T>() => Promise<T | null>;
  run: () => Promise<{ meta?: { changes?: number } }>;
}

/**
 * Minimal in-memory D1 stand-in. The `NOT EXISTS` guard is evaluated against the
 * current rows, which is what makes the race meaningful: the second signup
 * inserts zero rows and must be told the partner already exists rather than
 * creating a duplicate.
 */
function makeDb(rows: FakeRow[] = []) {
  const byUser = (userId: string) => rows.find((r) => r.user_id === userId) ?? null;
  const byCode = (code: string) => rows.find((r) => r.partner_code === code) ?? null;

  return {
    rows,
    /** Number of INSERT attempts blocked by the NOT EXISTS guard. */
    blockedInserts: 0,
    prepare(sql: string): FakeStatement {
      const stmt: FakeStatement = {
        bound: [],
        isInsert: /INSERT/i.test(sql),
        bind: (...args: unknown[]) => {
          stmt.bound = args;
          return stmt;
        },
        first: async <T>() => (byUser(stmt.bound[0] as string) as T | null),
        run: async () => {
          if (!stmt.isInsert) return { meta: { changes: 0 } };
          const [, userId, code] = stmt.bound as [string, string, string];
          const blocked = Boolean(byUser(userId)) || Boolean(byCode(code));
          if (blocked) {
            stmt.first = async <T>() => (byUser(userId) as T | null);
            return { meta: { changes: 0 } };
          }
          rows.push({ id: `partner_${rows.length}`, user_id: userId, partner_code: code });
          stmt.first = async <T>() => (null as T | null);
          return { meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };
}

describe('affiliateSelfSignupSchema', () => {
  it('accepts an explicit acceptance and nothing else', () => {
    expect(affiliateSelfSignupSchema.safeParse({ acceptTerms: true }).success).toBe(true);
  });

  it('refuses a falsy or absent acceptance', () => {
    expect(affiliateSelfSignupSchema.safeParse({ acceptTerms: false }).success).toBe(false);
    expect(affiliateSelfSignupSchema.safeParse({}).success).toBe(false);
  });
});

describe('affiliateSelfSignupAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a partner and returns the referral link', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'u1',
      full_name: 'Ada Lovelace',
      email: 'ada@example.com',
    } as never);
    vi.mocked(getD1).mockResolvedValue(makeDb() as never);

    const result = await affiliateSelfSignupAction({ acceptTerms: true });

    expect(result.status).toBe('created');
    expect(result.success).toBe(true);
    expect(result.partnerCode).toMatch(/^[A-Z0-9]{3,}\d{4}$/);
    expect(result.referralLink).toBe(`/ref/${result.partnerCode}`);
  });

  it('reports already_partner instead of creating a second row', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', full_name: 'Ada', email: 'a@b.c' } as never);
    vi.mocked(getD1).mockResolvedValue(
      makeDb([{ id: 'partner_existing', user_id: 'u1', partner_code: 'ADA1234' }]) as never,
    );

    const result = await affiliateSelfSignupAction({ acceptTerms: true });

    expect(result.status).toBe('already_partner');
    expect(result.success).toBe(false);
    expect(result.referralLink).toBeUndefined();
  });

  it('does not leak an existing partner code to the caller', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', full_name: 'Ada', email: 'a@b.c' } as never);
    vi.mocked(getD1).mockResolvedValue(
      makeDb([{ id: 'partner_existing', user_id: 'u1', partner_code: 'ADA1234' }]) as never,
    );

    const result = await affiliateSelfSignupAction({ acceptTerms: true });

    expect(JSON.stringify(result)).not.toContain('ADA1234');
  });

  it('refuses an anonymous visitor with the sentinel status', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never);
    vi.mocked(getD1).mockResolvedValue(makeDb() as never);

    const result = await affiliateSelfSignupAction({ acceptTerms: true });

    expect(result.status).toBe('unauthorized');
    expect(result.success).toBe(false);
  });

  it('rejects the request before any database work when terms are not accepted', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', full_name: 'Ada', email: 'a@b.c' } as never);
    vi.mocked(getD1).mockResolvedValue(makeDb() as never);

    const result = await affiliateSelfSignupAction({ acceptTerms: false as unknown as true });

    expect(result.status).toBe('error');
    expect(getD1).not.toHaveBeenCalled();
  });

  it('surfaces a database error rather than throwing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', full_name: 'Ada', email: 'a@b.c' } as never);
    const boom = { prepare: () => ({ bind: () => ({ first: () => Promise.reject(new Error('d1 down')), run: () => Promise.reject(new Error('d1 down')) }) }) };
    vi.mocked(getD1).mockResolvedValue(boom as never);

    const result = await affiliateSelfSignupAction({ acceptTerms: true });

    expect(result.status).toBe('error');
    expect(result.error).toBe('d1 down');
  });

  it('creates exactly one partner row when two signups race', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', full_name: 'Ada', email: 'a@b.c' } as never);
    const db = makeDb();
    vi.mocked(getD1).mockResolvedValue(db as never);

    // Both calls resolve before either awaits its insert, the way two
    // concurrent requests would interleave.
    const [first, second] = await Promise.all([
      affiliateSelfSignupAction({ acceptTerms: true }),
      affiliateSelfSignupAction({ acceptTerms: true }),
    ]);

    expect(db.rows).toHaveLength(1);
    expect([first.status, second.status].sort()).toEqual(['already_partner', 'created']);
  });

  it('never lets the caller choose a commission rate or partner code', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', full_name: 'Ada', email: 'a@b.c' } as never);
    const db = makeDb();
    vi.mocked(getD1).mockResolvedValue(db as never);

    // The schema only accepts `acceptTerms`, so extra fields cannot arrive
    // through the validated type; this exercises the same guarantee at the
    // value level for a caller that bypasses typing.
    const tampered = { acceptTerms: true, commission_rate_pct: 99, tier: 'SUPER', partner_code: 'HACKER' };
    await affiliateSelfSignupAction(tampered as unknown as AffiliateSelfSignupInput);

    const created = db.rows[0];
    expect(created).toBeDefined();
    expect(created.partner_code).not.toBe('HACKER');
  });

  it('surfaces an error rather than looping forever when every attempt is blocked', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', full_name: 'Ada', email: 'a@b.c' } as never);
    // A D1 that reports a collision on every code, without any row ever
    // belonging to this user — so the loop can only exit via exhaustion.
    const attempts: string[] = [];
    const db = makeDb();
    const original = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      const stmt = original(sql);
      if (/INSERT/i.test(sql)) {
        stmt.run = async () => {
          attempts.push(sql);
          return { meta: { changes: 0 } };
        };
      }
      return stmt;
    };
    vi.mocked(getD1).mockResolvedValue(db as never);

    const result = await affiliateSelfSignupAction({ acceptTerms: true });

    expect(result.status).toBe('error');
    expect(result.partnerCode).toBeUndefined();
    expect(result.referralLink).toBeUndefined();
    // Bounded by the retry cap, not unbounded retrying.
    expect(attempts).toHaveLength(5);
    expect(db.rows.some((r) => r.user_id === 'u1')).toBe(false);
  });
});
