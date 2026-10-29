/**
 * Workspace affiliate metrics — honesty tests.
 *
 * The contract under test: a figure this module could not read is reported
 * unavailable. It is never reported as `0`, because a workspace that produced
 * zero videos and a workspace whose count could not be read are different
 * facts, and the dashboard must be able to tell them apart.
 *
 * No provider is contacted and no real database is opened — `db` is a labelled
 * fixture that returns the shape D1 returns for `.prepare().bind().first()`.
 *
 * @module land/affiliates/__tests__/affiliate-live-metrics
 */

import { describe, it, expect, vi } from 'vitest';
import {
  loadWorkspaceAffiliateMetrics,
  AFFILIATE_METRICS_UNAVAILABLE,
} from '../affiliate-live-metrics';
import type { D1Database } from '@/seed/db/client';

interface FixtureRows {
  campaigns?: Array<{ count: number }>;
  partner?: Array<{ id: string }>;
  clicks?: Array<{ count: number }>;
}

/**
 * Minimal D1 stand-in. `failSql` lets a test make one statement throw while
 * leaving the others working, which is the case that distinguishes
 * "unavailable" from "zero".
 */
function fixtureDb(rows: FixtureRows, opts: { failSql?: string } = {}): D1Database {
  const make = (table: string, result: unknown) => ({
    sql: table,
    run: async () => {
      if (opts.failSql && table.includes(opts.failSql)) {
        throw new Error(`fixture failure on: ${opts.failSql}`);
      }
      return result;
    },
  });

  const campaigns = make('campaigns', (rows.campaigns ?? [])[0] ?? null);
  const partner = make('affiliate_partners', (rows.partner ?? [])[0] ?? null);
  const clicks = make('affiliate_referral_clicks', (rows.clicks ?? [])[0] ?? null);
  const statements = [campaigns, partner, clicks];

  return {
    prepare: (sql: string) => ({
      bind: () => {
        const stmt = statements.find((s) => sql.includes(s.sql));
        if (!stmt) throw new Error(`fixture has no statement for: ${sql}`);
        return {
          first: stmt.run,
          all: async () => ({ results: [], success: true, meta: {} }),
          run: stmt.run,
        };
      },
    }),
  } as unknown as D1Database;
}

describe('loadWorkspaceAffiliateMetrics', () => {
  it('returns the counts the workspace actually holds when every read succeeds', async () => {
    const db = fixtureDb({
      campaigns: [{ count: 12 }],
      partner: [{ id: 'partner_1' }],
      clicks: [{ count: 4310 }],
    });

    const result = await loadWorkspaceAffiliateMetrics(db, 'user_1');

    expect(result.metrics.totalVideosGenerated).toBe(12);
    expect(result.metrics.totalBridgeClicks).toBe(4310);
    expect(result.availability.totalVideosGenerated).toBe(true);
    expect(result.availability.totalBridgeClicks).toBe(true);
  });

  it('reports an unreadable video count as unavailable, not as zero', async () => {
    const db = fixtureDb(
      { campaigns: [], partner: [{ id: 'partner_1' }], clicks: [{ count: 7 }] },
      { failSql: 'campaigns' },
    );

    const result = await loadWorkspaceAffiliateMetrics(db, 'user_1');

    expect(result.availability.totalVideosGenerated).toBe(false);
    // The click read still succeeded and must not be suppressed by the other failure.
    expect(result.availability.totalBridgeClicks).toBe(true);
    expect(result.metrics.totalBridgeClicks).toBe(7);
  });

  it('reports an unreadable click count as unavailable, not as zero', async () => {
    const db = fixtureDb(
      { campaigns: [{ count: 3 }], partner: [{ id: 'partner_1' }] },
      { failSql: 'affiliate_referral_clicks' },
    );

    const result = await loadWorkspaceAffiliateMetrics(db, 'user_1');

    expect(result.availability.totalBridgeClicks).toBe(false);
    expect(result.availability.totalVideosGenerated).toBe(true);
    expect(result.metrics.totalVideosGenerated).toBe(3);
  });

  it('treats a user with no partner profile as zero clicks, not as unreadable', async () => {
    // No affiliate_partners row is a real fact about the workspace, so the
    // click count is a genuine 0 rather than an unavailable marker.
    const db = fixtureDb({ campaigns: [{ count: 5 }], partner: [] });

    const result = await loadWorkspaceAffiliateMetrics(db, 'user_no_partner');

    expect(result.metrics.totalBridgeClicks).toBe(0);
    expect(result.availability.totalBridgeClicks).toBe(true);
    expect(result.metrics.totalVideosGenerated).toBe(5);
  });

  it('treats a failed partner lookup as an unavailable click count', async () => {
    const db = fixtureDb({ campaigns: [{ count: 5 }] }, { failSql: 'affiliate_partners' });

    const result = await loadWorkspaceAffiliateMetrics(db, 'user_1');

    // Could not even determine whether a profile exists, so no click figure.
    expect(result.availability.totalBridgeClicks).toBe(false);
    expect(result.metrics.totalBridgeClicks).toBe(0);
  });

  it('never reads commission here — the Domain B pass owns that figure', async () => {
    const prepare = vi.fn((_sql: string) => ({
      bind: () => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => undefined,
      }),
    }));
    const db = { prepare } as unknown as D1Database;

    await loadWorkspaceAffiliateMetrics(db, 'user_1');

    const sqls = prepare.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => s.includes('commission_ledger'))).toBe(false);
    expect(sqls.some((s) => s.includes('workspace_external_commissions'))).toBe(false);
  });

  it('exposes an all-unavailable default so callers have no zero-filled fallback', () => {
    expect(AFFILIATE_METRICS_UNAVAILABLE.availability.totalVideosGenerated).toBe(false);
    expect(AFFILIATE_METRICS_UNAVAILABLE.availability.totalBridgeClicks).toBe(false);
    // The sentinel marks both unavailable, so its zero values must never be
    // rendered — this assertion pins the pairing that makes that safe.
    expect(AFFILIATE_METRICS_UNAVAILABLE.metrics.totalVideosGenerated).toBe(0);
  });
});
