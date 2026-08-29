/**
 * Server-action tests for investment-advisor.ts against the real in-memory
 * D1 shim — auth guard, validation, cross-tenant rejection, ROI aggregation
 * joined with latest-per-key learning velocity, deterministic ranking.
 *
 * @module land/creative-economy/__tests__/investment-advisor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const { mockCreateServerClient, mockGetCurrentUser, mockGetUserTier } = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockGetUserTier: vi.fn(),
}));
vi.mock('@/seed/db/client', () => ({
  createServerClient: mockCreateServerClient,
  getD1: vi.fn(),
}));
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));
vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: mockGetUserTier,
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getInvestmentAdvice } from '../investment-advisor';

const mockUser = { id: 'user-001', email: 'ceo@test.com' };

const EXTRA_TABLES = `
CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TEXT,
  UNIQUE(org_id, user_id)
);
CREATE TABLE IF NOT EXISTS learning_velocity (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  velocity_score REAL NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  window_start_ms INTEGER NOT NULL,
  window_end_ms INTEGER NOT NULL,
  avg_metrics TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER
);
`;

function setupDb(): ReturnType<typeof makeD1> {
  const raw = freshDb();
  raw.exec(EXTRA_TABLES);
  raw.exec(`INSERT INTO org_members (id, org_id, user_id, role)
            VALUES ('m1', 'ws-1', '${mockUser.id}', 'owner')`);
  const d1 = makeD1(raw);
  mockCreateServerClient.mockReturnValue(d1);
  return d1;
}

function insertEvent(
  db: ReturnType<typeof makeD1>,
  id: string,
  entityId: string,
  eventType: string,
  valueCents: number,
  recordedAtMs: number,
  channel = 'youtube',
): void {
  db.prepare(
    `INSERT INTO performance_events
     (id, workspace_id, entity_type, entity_id, channel, event_type, value_cents, recorded_at)
     VALUES (?1, 'ws-1', 'asset', ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(id, entityId, channel, eventType, valueCents, recordedAtMs)
    .run();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(mockUser);
  mockGetUserTier.mockResolvedValue('ENTERPRISE');
});

describe('getInvestmentAdvice', () => {
  it('requires authentication', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    setupDb();
    const result = await getInvestmentAdvice({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('requires valid workspaceId', async () => {
    setupDb();
    const result = await getInvestmentAdvice({ workspaceId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects windowDays outside 1-90', async () => {
    setupDb();
    const result = await getInvestmentAdvice({ workspaceId: 'ws-1', windowDays: 91 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown workspaces (cross-tenant)', async () => {
    setupDb();
    const result = await getInvestmentAdvice({ workspaceId: 'ws-other' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('returns empty advice for a workspace with no events', async () => {
    setupDb();
    const result = await getInvestmentAdvice({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('ranks investments by composite score with latest velocity per key', async () => {
    const db = setupDb();
    const nowMs = Date.now();

    // a1/youtube: revenue 3500, cost 1000 → roi 250, velocity 60 → scale_up
    insertEvent(db, 'e1', 'a1', 'revenue', 3000, nowMs);
    insertEvent(db, 'e2', 'a1', 'sponsorship', 500, nowMs);
    insertEvent(db, 'e3', 'a1', 'mission_completed', 1000, nowMs);
    // b1/tiktok: revenue 200, cost 1000 → roi -80, no velocity → cut_loss
    insertEvent(db, 'e4', 'b1', 'revenue', 200, nowMs, 'tiktok');
    insertEvent(db, 'e5', 'b1', 'mission_completed', 1000, nowMs, 'tiktok');

    // Two velocity rows for asset:youtube — latest window_end_ms wins (60).
    db.prepare(
      `INSERT INTO learning_velocity
       (id, workspace_id, entity_type, channel, velocity_score, window_start_ms, window_end_ms)
       VALUES ('v1', 'ws-1', 'asset', 'youtube', 30, 1000, 2000)`,
    ).run();
    db.prepare(
      `INSERT INTO learning_velocity
       (id, workspace_id, entity_type, channel, velocity_score, window_start_ms, window_end_ms)
       VALUES ('v2', 'ws-1', 'asset', 'youtube', 60, 4000, 5000)`,
    ).run();

    const result = await getInvestmentAdvice({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.map((r) => r.entityId)).toEqual(['a1', 'b1']);

    const [a1, b1] = result.value;
    expect(a1.revenueCents).toBe(3500);
    expect(a1.costCents).toBe(1000);
    expect(a1.roiPct).toBe(250);
    expect(a1.velocityScore).toBe(60);
    expect(a1.compositeScore).toBe(84); // round(0.6*100 + 0.4*60)
    expect(a1.recommendation).toBe('scale_up');
    expect(a1.reasons).toEqual(['POSITIVE_ROI', 'FAST_LEARNING']);

    expect(b1.roiPct).toBe(-80);
    expect(b1.velocityScore).toBeNull();
    expect(b1.compositeScore).toBe(26); // round(0.6*10 + 0.4*50)
    expect(b1.recommendation).toBe('cut_loss');
    expect(b1.reasons).toEqual(['NEGATIVE_ROI', 'NO_VELOCITY_DATA']);
  });

  it('marks revenue-only entities as insufficient_data (no cost)', async () => {
    const db = setupDb();
    insertEvent(db, 'e1', 'a1', 'revenue', 500, Date.now());

    const result = await getInvestmentAdvice({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0].roiPct).toBeNull();
    expect(result.value[0].recommendation).toBe('insufficient_data');
    expect(result.value[0].reasons).toContain('NO_COST_DATA');
  });

  it('excludes events outside the window and ignored event types', async () => {
    const db = setupDb();
    const nowMs = Date.now();
    const staleMs = nowMs - 31 * 24 * 60 * 60 * 1000 - 1;
    insertEvent(db, 'stale', 'a1', 'revenue', 9999, staleMs);
    insertEvent(db, 'ignored', 'a1', 'impression', 1234, nowMs);

    const result = await getInvestmentAdvice({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('rejects BASIC tier users (investment advisor is ENTERPRISE+)', async () => {
    mockGetUserTier.mockResolvedValueOnce('BASIC');
    setupDb();
    const result = await getInvestmentAdvice({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('rejects PREMIUM tier users (investment advisor requires ENTERPRISE+)', async () => {
    mockGetUserTier.mockResolvedValueOnce('PREMIUM');
    setupDb();
    const result = await getInvestmentAdvice({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('allows ENTERPRISE and MASTER tier users', async () => {
    for (const tier of ['ENTERPRISE', 'MASTER'] as const) {
      mockGetUserTier.mockResolvedValueOnce(tier);
      const db = setupDb();
      const result = await getInvestmentAdvice({ workspaceId: 'ws-1' });
      expect(result.ok).toBe(true);
    }
  });
});
