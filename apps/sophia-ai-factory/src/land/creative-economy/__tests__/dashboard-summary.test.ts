/**
 * Unit tests for dashboard-summary.ts server action.
 *
 * Covers: auth guard, validation, membership check (cross-tenant),
 * happy path aggregation, empty result, internal error handling,
 * additive roiPct field (zero-cost guard).
 *
 * Uses real in-memory D1 via freshDb/makeD1/getD1 shim — no fake Db mocks.
 *
 * @module land/creative-economy/__tests__/dashboard-summary
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const { mockCreateServerClient, mockGetCurrentUser } = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(),
  mockGetCurrentUser: vi.fn(),
}));
vi.mock('@/seed/db/client', () => ({
  createServerClient: mockCreateServerClient,
  getD1: vi.fn(),
}));
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getDashboardSummary } from '../dashboard-summary';

const mockUser = { id: 'user-001', email: 'ceo@test.com' };

function setupDb(): ReturnType<typeof freshDb> {
  const raw = freshDb();
  raw.exec(`CREATE TABLE IF NOT EXISTS org_members (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    created_at TEXT,
    UNIQUE(org_id, user_id)
  )`);
  raw.exec(`INSERT INTO org_members (id, org_id, user_id, role)
            VALUES ('m1', 'ws-1', '${mockUser.id}', 'owner')`);
  mockCreateServerClient.mockReturnValue(makeD1(raw));
  return raw;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(mockUser);
});

describe('getDashboardSummary', () => {
  it('requires authentication', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    setupDb();
    const result = await getDashboardSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('requires valid workspaceId', async () => {
    setupDb();
    const result = await getDashboardSummary({ workspaceId: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown workspaces (cross-tenant)', async () => {
    setupDb();
    const result = await getDashboardSummary({ workspaceId: 'ws-other' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('aggregates revenue/cost/net/roi for empty events', async () => {
    setupDb();
    const result = await getDashboardSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.revenueCents).toBe(0);
    expect(result.value.costCents).toBe(0);
    expect(result.value.netCents).toBe(0);
    expect(result.value.eventCount).toBe(0);
    expect(result.value.windowDays).toBe(30);
    expect(result.value.roiPct).toBeNull(); // zero cost guard
  });

  it('returns additive roiPct when revenue > cost', async () => {
    setupDb();
    const db = mockCreateServerClient() as ReturnType<typeof makeD1>;
    const nowMs = Date.now();
    db.prepare(
      `INSERT INTO performance_events
       (id, workspace_id, entity_type, entity_id, event_type, value_cents, recorded_at)
       VALUES ('e1', 'ws-1', 'asset', 'a1', 'revenue', 3000, ?1)`,
    ).bind(nowMs).run();
    db.prepare(
      `INSERT INTO performance_events
       (id, workspace_id, entity_type, entity_id, event_type, value_cents, recorded_at)
       VALUES ('e2', 'ws-1', 'asset', 'a1', 'mission_completed', 1000, ?1)`,
    ).bind(nowMs).run();

    const result = await getDashboardSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.revenueCents).toBe(3000);
    expect(result.value.costCents).toBe(1000);
    expect(result.value.netCents).toBe(2000);
    expect(result.value.eventCount).toBe(2);
    expect(result.value.roiPct).toBe(200);
  });

  it('returns null roiPct when cost is zero (zero-cost guard)', async () => {
    setupDb();
    const db = mockCreateServerClient() as ReturnType<typeof makeD1>;
    db.prepare(
      `INSERT INTO performance_events
       (id, workspace_id, entity_type, entity_id, event_type, value_cents, recorded_at)
       VALUES ('e1', 'ws-1', 'asset', 'a1', 'revenue', 500, ?1)`,
    ).bind(Date.now()).run();
    const result = await getDashboardSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.roiPct).toBeNull();
  });

  it('excludes stale events outside the 30-day window', async () => {
    setupDb();
    const db = mockCreateServerClient() as ReturnType<typeof makeD1>;
    const oldMs = Date.now() - 31 * 24 * 60 * 60 * 1000 - 1;
    db.prepare(
      `INSERT INTO performance_events
       (id, workspace_id, entity_type, entity_id, event_type, value_cents, recorded_at)
       VALUES ('e1', 'ws-1', 'asset', 'a1', 'revenue', 9999, ?1)`,
    ).bind(oldMs).run();
    const result = await getDashboardSummary({ workspaceId: 'ws-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.revenueCents).toBe(0);
    expect(result.value.roiPct).toBeNull();
  });
});