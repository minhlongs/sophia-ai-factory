/**
 * Unit tests: CreativeEconomicSnapshot writer (Phase H).
 *
 * Covers NULL propagation (no mission record / no revenue → cost, outcome,
 * and revenue fields are NULL and the writer returns without error), the
 * recordSpend path (creative_cost populated from creative_missions.spent_cents),
 * the honest-zero boundary (a real mission with spent_cents = 0 reads as 0 —
 * "measured zero", not null), the no-producer fields (production_cost /
 * distribution_cost / leads / conversions always NULL), the never-throws
 * contract when tables are missing, and persistence of the written row.
 *
 * Real in-memory D1 via the shared shim — no fake Db mocks.
 *
 * @module land/creative-economy/__tests__/snapshot-writer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const { mockGetD1 } = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));
vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
  getD1: mockGetD1,
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { writeCreativeEconomicSnapshot } from '../snapshot-writer';

// Matches migrations/0263_creative_economic_snapshot.sql (not in the shim SCHEMA).
const ECONOMIC_SNAPSHOT_SCHEMA = `
CREATE TABLE IF NOT EXISTS creative_economic_snapshot (
  id                  TEXT PRIMARY KEY,
  workspace_id        TEXT NOT NULL,
  mission_id          TEXT,
  creative_cost       INTEGER,
  production_cost     INTEGER,
  distribution_cost   INTEGER,
  leads               INTEGER,
  conversions         INTEGER,
  revenue             INTEGER,
  recorded_at         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_creative_econ_snapshot_mission
  ON creative_economic_snapshot(mission_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_creative_econ_snapshot_workspace
  ON creative_economic_snapshot(workspace_id, recorded_at DESC);
`;

function setupDb(): ReturnType<typeof freshDb> {
  const raw = freshDb();
  raw.exec(ECONOMIC_SNAPSHOT_SCHEMA);
  mockGetD1.mockResolvedValue(makeD1(raw));
  return raw;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('writeCreativeEconomicSnapshot', () => {
  it('returns a fully-null snapshot when no mission record or revenue data exists', async () => {
    setupDb();
    // Mission does not exist in creative_missions → no cost source datum.
    const snap = await writeCreativeEconomicSnapshot('mission-ghost', 'ws-1');

    expect(snap.id).toMatch(/^ces_/);
    expect(snap.workspaceId).toBe('ws-1');
    expect(snap.missionId).toBe('mission-ghost');
    // Every measurement boundary is NULL — no source datum, never 0.
    expect(snap.creativeCost).toBeNull();
    expect(snap.productionCost).toBeNull();
    expect(snap.distributionCost).toBeNull();
    expect(snap.leads).toBeNull();
    expect(snap.conversions).toBeNull();
    expect(snap.revenue).toBeNull();
    expect(Number.isInteger(snap.recordedAt)).toBe(true);
  });

  it('populates creative_cost from recordSpend totals and persists the row', async () => {
    const raw = setupDb();
    raw.exec(
      `INSERT INTO creative_missions (id, workspace_id, creator_id, title, spent_cents)
       VALUES ('m-1', 'ws-1', 'creator-1', 'Test Mission', 4250)`,
    );

    const snap = await writeCreativeEconomicSnapshot('m-1', 'ws-1');

    expect(snap.creativeCost).toBe(4250);
    // recordSpend has no per-category breakdown — these stay NULL.
    expect(snap.productionCost).toBeNull();
    expect(snap.distributionCost).toBeNull();
    // No producer exists for leads / conversions / mission-scoped revenue.
    expect(snap.leads).toBeNull();
    expect(snap.conversions).toBeNull();
    expect(snap.revenue).toBeNull();

    // The row was persisted with NULLs intact. Read through the D1 shim
    // (the raw node:sqlite DatabaseSync has no .bind() chain).
    const db = makeD1(raw);
    const row = await db
      .prepare(
        `SELECT creative_cost, production_cost, distribution_cost, leads, conversions, revenue
         FROM creative_economic_snapshot WHERE id = ?1`,
      )
      .bind(snap.id)
      .first<{
        creative_cost: number | null;
        production_cost: number | null;
        distribution_cost: number | null;
        leads: number | null;
        conversions: number | null;
        revenue: number | null;
      }>();
    expect(row?.creative_cost).toBe(4250);
    expect(row?.production_cost).toBeNull();
    expect(row?.distribution_cost).toBeNull();
    expect(row?.leads).toBeNull();
    expect(row?.conversions).toBeNull();
    expect(row?.revenue).toBeNull();
  });

  it('reads an honest 0 (not null) for a real mission that has spent nothing', async () => {
    const raw = setupDb();
    // spent_cents is NOT NULL DEFAULT 0 — a fresh mission carries a real
    // recordSpend total of 0, which is a measurement ("zero spent"), not a
    // missing signal. The writer must read it as-is, never synthesize null.
    raw.exec(
      `INSERT INTO creative_missions (id, workspace_id, creator_id, title, spent_cents)
       VALUES ('m-2', 'ws-1', 'creator-1', 'Unspent Mission', 0)`,
    );

    const snap = await writeCreativeEconomicSnapshot('m-2', 'ws-1');

    expect(snap.creativeCost).toBe(0);
    expect(snap.revenue).toBeNull();
  });

  it('never throws when the snapshot table is missing', async () => {
    // freshDb has creative_missions but NOT creative_economic_snapshot.
    const raw = freshDb();
    mockGetD1.mockResolvedValue(makeD1(raw));

    // Must resolve, not reject — the writer degrades to a null-populated snapshot.
    const snap = await writeCreativeEconomicSnapshot('m-3', 'ws-1');
    expect(snap.creativeCost).toBeNull();
    expect(snap.revenue).toBeNull();
  });

  it('returns the snapshot unchanged (non-fatal) when the insert fails', async () => {
    const raw = setupDb();
    // Drop the table mid-flight to force an INSERT error. The writer must
    // catch, log, and still return the populated snapshot.
    raw.exec('DROP TABLE creative_economic_snapshot');
    raw.exec(
      `INSERT INTO creative_missions (id, workspace_id, creator_id, title, spent_cents)
       VALUES ('m-4', 'ws-1', 'creator-1', 'Failing Insert', 900)`,
    );

    const snap = await writeCreativeEconomicSnapshot('m-4', 'ws-1');
    expect(snap.missionId).toBe('m-4');
    expect(snap.creativeCost).toBe(900);
    expect(snap.id).toMatch(/^ces_/);
  });
});
