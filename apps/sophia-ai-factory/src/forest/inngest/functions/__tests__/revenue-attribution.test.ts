/**
 * Unit tests for revenue attribution (SUPREME COMMAND #10 — Phase 7, tests 8-10).
 *
 * Tests the tree-layer applyAttributionToJob() entry point against an in-memory
 * SQLite DB (shared D1 shim). Covers:
 *   - test 8: happy path — provenance written, job updated with revenue + margin
 *   - test 9: idempotency — re-running yields already_owned, no double-count
 *   - test 10: multi-candidate — last-touch wins, single attribution
 *
 * @module forest/inngest/functions/__tests__/revenue-attribution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn(), getD1: mockGetD1 }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { applyAttributionToJob } from '@/tree/media-jobs/attribution-apply';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS media_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'video',
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  provider_cost INTEGER,
  revenue_attribution INTEGER,
  gross_margin INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS attribution_provenance (
  id TEXT PRIMARY KEY,
  media_job_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  attributed_amount_cents INTEGER NOT NULL,
  attribution_rule TEXT NOT NULL,
  attribution_window_days INTEGER NOT NULL DEFAULT 30,
  job_completed_at INTEGER,
  revenue_recorded_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT 0,
  UNIQUE(media_job_id, source_event_id)
);`;

function setupDb(): ReturnType<typeof freshDb> {
  const raw = freshDb();
  raw.exec(SCHEMA);
  mockGetD1.mockReturnValue(makeD1(raw));
  return raw;
}

function insertJob(raw: ReturnType<typeof freshDb>, jobId: string, completedAtSec: number, providerCost: number | null): void {
  raw
    .prepare(
      `INSERT INTO media_jobs (id, user_id, model, status, provider_cost, completed_at, created_at)
       VALUES (?, 'user-1', 'fal.ai', 'completed', ?, ?, ?)`,
    )
    .run(jobId, providerCost, completedAtSec, completedAtSec);
}

function query(raw: ReturnType<typeof freshDb>, sql: string, ...params: unknown[]): unknown {
  return raw.prepare(sql).get(...params);
}

beforeEach(() => { vi.clearAllMocks(); });

describe('applyAttributionToJob', () => {
  it('test 8 — happy path: provenance written, job updated with revenue + margin', async () => {
    const raw = setupDb();
    const completedAtSec = 1_000_000;
    insertJob(raw, 'job-1', completedAtSec, 250);

    const recordedAtMs = (completedAtSec + 10 * 86400) * 1000;
    const result = await applyAttributionToJob({
      jobId: 'job-1',
      sourceEventId: 'evt-1',
      sourceType: 'revenue',
      channel: 'youtube',
      valueCents: 1000,
      recordedAt: recordedAtMs,
      jobCompletedAt: completedAtSec,
      providerCostCents: 250,
    });

    expect(result.attributed).toBe(true);
    expect(result.revenueCents).toBe(1000);
    expect(result.grossMarginPercent).toBe(75);

    const row = query(raw, 'SELECT revenue_attribution, gross_margin FROM media_jobs WHERE id = ?', 'job-1') as { revenue_attribution: number; gross_margin: number };
    expect(row.revenue_attribution).toBe(1000);
    expect(row.gross_margin).toBe(75);

    const prov = query(raw, 'SELECT COUNT(*) AS n FROM attribution_provenance WHERE media_job_id = ?', 'job-1') as { n: number };
    expect(prov.n).toBe(1);
  });

  it('test 9 — idempotency: re-run yields already_owned, no double-count', async () => {
    const raw = setupDb();
    const completedAtSec = 1_000_000;
    insertJob(raw, 'job-2', completedAtSec, 250);

    const recordedAtMs = (completedAtSec + 5 * 86400) * 1000;
    const first = await applyAttributionToJob({
      jobId: 'job-2',
      sourceEventId: 'evt-2',
      sourceType: 'revenue',
      channel: 'youtube',
      valueCents: 1000,
      recordedAt: recordedAtMs,
      jobCompletedAt: completedAtSec,
      providerCostCents: 250,
    });
    expect(first.attributed).toBe(true);

    const second = await applyAttributionToJob({
      jobId: 'job-2',
      sourceEventId: 'evt-2',
      sourceType: 'revenue',
      channel: 'youtube',
      valueCents: 1000,
      recordedAt: recordedAtMs,
      jobCompletedAt: completedAtSec,
      providerCostCents: 250,
    });
    expect(second.attributed).toBe(false);
    expect(second.reason).toBe('already_owned');

    const prov = query(raw, 'SELECT COUNT(*) AS n FROM attribution_provenance WHERE media_job_id = ?', 'job-2') as { n: number };
    expect(prov.n).toBe(1);

    const row = query(raw, 'SELECT revenue_attribution FROM media_jobs WHERE id = ?', 'job-2') as { revenue_attribution: number };
    expect(row.revenue_attribution).toBe(1000);
  });

  it('test 10 — multi-candidate: two distinct events, two provenance rows, last UPDATE wins', async () => {
    const raw = setupDb();
    const completedAtSec = 1_000_000;
    insertJob(raw, 'job-3', completedAtSec, 200);

    const t1 = (completedAtSec + 3 * 86400) * 1000;
    const r1 = await applyAttributionToJob({
      jobId: 'job-3',
      sourceEventId: 'evt-3a',
      sourceType: 'revenue',
      channel: 'youtube',
      valueCents: 500,
      recordedAt: t1,
      jobCompletedAt: completedAtSec,
      providerCostCents: 200,
    });
    expect(r1.attributed).toBe(true);

    const t2 = (completedAtSec + 15 * 86400) * 1000;
    const r2 = await applyAttributionToJob({
      jobId: 'job-3',
      sourceEventId: 'evt-3b',
      sourceType: 'revenue',
      channel: 'youtube',
      valueCents: 800,
      recordedAt: t2,
      jobCompletedAt: completedAtSec,
      providerCostCents: 200,
    });
    expect(r2.attributed).toBe(true);

    // Provenance UNIQUE is on (job, event) — two distinct events = two rows.
    const prov = query(raw, 'SELECT COUNT(*) AS n FROM attribution_provenance WHERE media_job_id = ?', 'job-3') as { n: number };
    expect(prov.n).toBe(2);

    // Job reflects last UPDATE (evt-3b: 800 cents).
    const row = query(raw, 'SELECT revenue_attribution FROM media_jobs WHERE id = ?', 'job-3') as { revenue_attribution: number };
    expect(row.revenue_attribution).toBe(800);
  });
});
