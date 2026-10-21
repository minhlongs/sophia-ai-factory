/**
 * Tests for the affiliate nightly risk job.
 *
 * Two layers are covered:
 *   1. The pure selection/threshold logic in the helpers, driven by a mocked D1
 *      binding — which partners get scored, what gets written, and what happens
 *      when one partner's row read fails.
 *   2. The Inngest registration itself — cron schedule and id — captured through
 *      the same createFunction-capture pattern as approval-timeout-cron.test.ts.
 *
 * @module forest/inngest/functions/__tests__/affiliate-nightly-risk
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  registrations: [] as Array<{ config: unknown; trigger: unknown; handler: unknown }>,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn(
      (config: unknown, trigger: unknown, handler: unknown) => {
        mocks.registrations.push({ config, trigger, handler });
        return { _handler: handler };
      },
    ),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

import { affiliateNightlyRisk } from '../affiliate-nightly-risk';
import {
  RISK_LOOKBACK_MS,
  listPartnersWithRecentClicks,
  loadPartnerClicks,
  scoreAllPartners,
  scoreSinglePartner,
  writePartnerVerdict,
} from '../affiliate-nightly-risk-helpers';

/** Runs a step body immediately, mirroring Inngest's synchronous test mode. */
interface StepLike {
  run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
}

/** A human-like user agent, so the clean partner scores zero. */
const HUMAN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Minimal stand-in for D1Database covering only the methods the helpers use.
 * `queries` records every statement so a test can assert what was written.
 */
function createMockDb(rows: {
  partners?: Array<{ id: string; status: string }>;
  clicks?: Record<string, Array<{ ipHash: string | null; userAgent: string | null; createdAt: number }>>;
} = {}): {
  db: D1Database;
  queries: Array<{ sql: string; bind: unknown[] }>;
} {
  const queries: Array<{ sql: string; bind: unknown[] }> = [];
  const partnerRows = (rows.partners ?? []).map((p) => ({ id: p.id, status: p.status }));
  const clickRows = rows.clicks ?? {};

  const db = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          bound = args;
          return statement;
        },
        async all<T>() {
          queries.push({ sql, bind: bound });
          if (sql.includes('DISTINCT p.id')) {
            return { results: partnerRows as unknown as T[] };
          }
          // Click query is bound as (partnerId, cutoff).
          const partnerId = bound[0];
          return { results: (clickRows[String(partnerId)] ?? []) as unknown as T[] };
        },
        async run() {
          queries.push({ sql, bind: bound });
          return { meta: { changes: 1 } };
        },
        async first<T>() {
          queries.push({ sql, bind: bound });
          return null as T | null;
        },
      };
      return statement;
    },
  };

  return { db: db as unknown as D1Database, queries };
}

describe('affiliate-nightly-risk registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is registered as a nightly cron with retries', () => {
    expect(mocks.registrations).toHaveLength(1);
    const { config, trigger } = mocks.registrations[0] as {
      config: { id: string; retries: number };
      trigger: { cron: string };
    };
    expect(config.id).toBe('affiliate-nightly-risk');
    expect(config.retries).toBe(2);
    expect(trigger.cron).toBe('30 3 * * *');
  });

  it('returns an empty summary when D1 is unavailable', async () => {
    // Force the no-binding branch so the run is deterministic rather than
    // depending on whether the ambient test harness provides a local D1.
    const dbModule = await import('@/seed/db/client');
    const spy = vi.spyOn(dbModule, 'getD1').mockResolvedValue(null);

    const handler = (affiliateNightlyRisk as unknown as {
      _handler: (arg: { step: StepLike }) => Promise<unknown>;
    })._handler;

    const step = { run: async (_name: string, fn: () => Promise<unknown>) => fn() };
    const result = await handler({ step });

    expect(result).toMatchObject({ evaluated: 0, flagged: 0 });
    expect(mocks.logger.warn).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('reports the flagged count and flagged partner ids when partners are scored', async () => {
    // Score a single partner through the real job body, driving the helper with
    // a mocked D1 binding so the wiring itself is exercised end to end.
    const dbModule = await import('@/seed/db/client');
    const base = 8_000_000;
    const flood = Array.from({ length: 60 }, (_, i) => ({
      ipHash: 'h1',
      userAgent: 'curl/8.4.0',
      createdAt: base + i * 900,
    }));
    const spy = vi.spyOn(dbModule, 'getD1').mockResolvedValue(
      createMockDb({
        partners: [{ id: 'p1', status: 'active' }],
        clicks: { p1: flood },
      }).db,
    );

    const handler = (affiliateNightlyRisk as unknown as {
      _handler: (arg: { step: StepLike }) => Promise<{ evaluated: number; flagged: number }>;
    })._handler;

    const step = { run: async (_name: string, fn: () => Promise<unknown>) => fn() };
    const result = await handler({ step });

    expect(result.evaluated).toBe(1);
    expect(result.flagged).toBe(1);
    expect(mocks.logger.info).toHaveBeenCalledWith(
      '[affiliate-nightly-risk] Completed',
      expect.objectContaining({ evaluated: 1, flagged: 1, flaggedPartnerIds: ['p1'] }),
    );

    spy.mockRestore();
  });
});

describe('listPartnersWithRecentClicks', () => {
  it('returns partners that clicked inside the window', async () => {
    const { db, queries } = createMockDb({
      partners: [{ id: 'p1', status: 'active' }, { id: 'p2', status: 'under_review' }],
    });

    const partners = await listPartnersWithRecentClicks(db, RISK_LOOKBACK_MS);

    expect(partners).toEqual([
      { id: 'p1', status: 'active' },
      { id: 'p2', status: 'under_review' },
    ]);
    expect(queries[0].sql).toContain('affiliate_referral_clicks');
    // Reads only ip_hash/user_agent downstream; the partner query takes a cutoff.
    expect(queries[0].bind[0]).toBeTypeOf('number');
  });

  it('returns an empty list when there is no recent traffic', async () => {
    const { db } = createMockDb();
    expect(await listPartnersWithRecentClicks(db, RISK_LOOKBACK_MS)).toEqual([]);
  });
});

describe('loadPartnerClicks', () => {
  it('maps rows to click samples and never selects a raw ip', async () => {
    const clicks = [
      { ipHash: 'h1', userAgent: HUMAN_UA, createdAt: 1000 },
      { ipHash: null, userAgent: null, createdAt: 2000 },
    ];
    const { db, queries } = createMockDb({ clicks: { p1: clicks } });

    const samples = await loadPartnerClicks(db, 'p1', RISK_LOOKBACK_MS);

    expect(samples).toEqual(clicks);
    expect(queries[0].sql).toContain('ip_hash');
    expect(queries[0].sql).not.toMatch(/\bip\b(?!_hash)/);
  });
});

describe('writePartnerVerdict', () => {
  it('persists score, timestamp, flag and resolved status', async () => {
    const { db, queries } = createMockDb();

    await writePartnerVerdict(db, 'p1', 'under_review', 0.62, true);
    await writePartnerVerdict(db, 'p2', 'active', 0, false);

    expect(queries).toHaveLength(2);
    const [flagged, clean] = queries;
    expect(flagged.sql).toContain('risk_score');
    expect(flagged.sql).toContain('is_suspicious');
    expect(flagged.bind).toEqual([0.62, expect.any(Number), 1, 'under_review', 'p1']);
    // A clean partner is written back as 0/active, not left stale.
    expect(clean.bind).toEqual([0, expect.any(Number), 0, 'active', 'p2']);
  });
});

describe('scoreSinglePartner', () => {
  it('flags a partner whose clicks are bot traffic and moves them to under_review', async () => {
    const base = 8_000_000;
    // 60 clicks/hour from one client with one ip and a curl UA — every rule fires.
    const flood = Array.from({ length: 60 }, (_, i) => ({
      ipHash: 'h1',
      userAgent: 'curl/8.4.0',
      createdAt: base + i * 900,
    }));
    const { db, queries } = createMockDb({ clicks: { p1: flood } });

    const outcome = await scoreSinglePartner(db, { id: 'p1', status: 'active' }, RISK_LOOKBACK_MS);

    expect(outcome.partnerId).toBe('p1');
    expect(outcome.isSuspicious).toBe(true);
    expect(outcome.statusChanged).toBe(true);
    expect(outcome.clickCount).toBe(60);
    // The write happened, and it carried the review status.
    const write = queries.find((q) => q.sql.includes('UPDATE affiliate_partners'));
    expect(write?.bind).toEqual([
      outcome.score,
      expect.any(Number),
      1,
      'under_review',
      'p1',
    ]);
  });

  it('leaves a clean partner active and reports no status change', async () => {
    const clean = [
      { ipHash: 'h1', userAgent: HUMAN_UA, createdAt: 1000 },
      { ipHash: 'h2', userAgent: 'Mozilla/5.0 (iPhone)', createdAt: 5000 },
    ];
    const { db } = createMockDb({ clicks: { p1: clean } });

    const outcome = await scoreSinglePartner(db, { id: 'p1', status: 'active' }, RISK_LOOKBACK_MS);

    expect(outcome.score).toBe(0);
    expect(outcome.isSuspicious).toBe(false);
    expect(outcome.statusChanged).toBe(false);
  });

  it('does not lift a human suspension even when the traffic is clean', async () => {
    const clean = [{ ipHash: 'h1', userAgent: HUMAN_UA, createdAt: 1000 }];
    const { db, queries } = createMockDb({ clicks: { p1: clean } });

    const outcome = await scoreSinglePartner(db, { id: 'p1', status: 'suspended' }, RISK_LOOKBACK_MS);

    expect(outcome.statusChanged).toBe(false);
    const write = queries.find((q) => q.sql.includes('UPDATE affiliate_partners'));
    expect(write?.bind[3]).toBe('suspended');
  });
});

describe('scoreAllPartners', () => {
  it('summarises the run across partners', async () => {
    const base = 8_000_000;
    const flood = Array.from({ length: 60 }, (_, i) => ({
      ipHash: 'h1',
      userAgent: 'curl/8.4.0',
      createdAt: base + i * 900,
    }));
    const { db } = createMockDb({
      partners: [{ id: 'p1', status: 'active' }, { id: 'p2', status: 'active' }],
      clicks: { p1: flood, p2: [{ ipHash: 'h9', userAgent: HUMAN_UA, createdAt: 1234 }] },
    });

    const summary = await scoreAllPartners(db, RISK_LOOKBACK_MS);

    expect(summary.evaluated).toBe(2);
    expect(summary.flagged).toBe(1);
    expect(summary.errors).toBe(0);
    expect(summary.outcomes).toHaveLength(2);
  });

  it('returns a zero summary when no partner has recent clicks', async () => {
    const { db } = createMockDb();
    const summary = await scoreAllPartners(db, RISK_LOOKBACK_MS);

    expect(summary).toMatchObject({ evaluated: 0, flagged: 0, errors: 0 });
    expect(summary.outcomes).toEqual([]);
  });

  it('isolates one partner failure and still scores the rest', async () => {
    const base = 8_000_000;
    const ok = [{ ipHash: 'h1', userAgent: HUMAN_UA, createdAt: 1234 }];
    const { db, queries } = createMockDb({
      partners: [{ id: 'p1', status: 'active' }, { id: 'p2', status: 'active' }],
      clicks: { p1: ok, p2: Array.from({ length: 60 }, (_, i) => ({ ipHash: 'x', userAgent: 'curl/1', createdAt: base + i * 900 })) },
    });

    // Make the FIRST per-partner click read throw, so partner p1 fails but p2
    // still runs. Only the single-partner click query matches — the partner-list
    // query joins affiliate_partners and must still succeed.
    let calls = 0;
    const originalPrepare = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      const stmt = originalPrepare(sql);
      if (sql.includes('WHERE affiliate_partner_id = ?')) {
        const realAll = stmt.all.bind(stmt);
        stmt.all = async <T,>() => {
          calls += 1;
          if (calls === 1) throw new Error('D1 read failed');
          return realAll<T>();
        };
      }
      return stmt;
    };

    const summary = await scoreAllPartners(db, RISK_LOOKBACK_MS);

    expect(summary.errors).toBe(1);
    expect(summary.evaluated).toBe(1);
    expect(mocks.logger.error).toHaveBeenCalled();
    expect(queries.some((q) => q.sql.includes('UPDATE affiliate_partners'))).toBe(true);
  });
});
