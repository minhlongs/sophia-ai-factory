/**
 * Tests for tree/mission lifecycle (Sophia 2027 Phase 1).
 *
 * Covers: canTransition (valid/invalid grid), the named execution-start rule
 *         (EXECUTION_START_FROM / canStartExecution), createMission,
 *         updateMissionStatus (valid transitions), D1_UNAVAILABLE +
 *         NOT_FOUND error paths.
 *
 * Guarded-write behavior (beginMissionExecution, optimistic concurrency)
 * is covered against real SQL in repository.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

import {
  canTransition,
  canStartExecution,
  EXECUTION_START_FROM,
  createMission,
  updateMissionStatus,
} from '../types';
import type { Mission, CreativeMissionStatus } from '@/seed/types/creative-economy';

interface PreparedStmt {
  first?: unknown;
  run?: unknown;
  all?: unknown;
}

function buildDb(stmts: PreparedStmt[]) {
  let i = 0;
  return {
    prepare: vi.fn(() => {
      const stmt = stmts[i++];
      if (!stmt) throw new Error('No more prepared stmts mocked');
      return {
        bind: () => ({
          first: async () => stmt.first,
          run: async () => (typeof stmt.run === 'function' ? stmt.run() : (stmt.run ?? { success: true, meta: { changes: 0, duration: 1 } })),
          all: async () => stmt.all ?? { results: [], meta: { changes: 0, duration: 1 } },
        }),
      };
    }),
  };
}

function stmt(opts: PreparedStmt = {}): PreparedStmt {
  return {
    first: opts.first,
    run: opts.run,
    all: opts.all,
  };
}

const FIXED_NOW_MS = 1700000000000; // known timestamp in ms
const FIXED_NOW_S = Math.floor(FIXED_NOW_MS / 1000); // 1700000000

function missionRow(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'msn_fixed',
    workspaceId: 'ws_001',
    creatorId: 'user_001',
    brandId: 'brand_001',
    title: 'Sustainable SEA Media Empire',
    objective: 'Build media business around sustainable living',
    audience: 'Eco-conscious millennials',
    geography: 'SEA',
    timeframeStart: new Date('2027-01-01').getTime() / 1000,
    timeframeEnd: new Date('2027-12-31').getTime() / 1000,
    budgetCents: 500000,
    spentCents: 0,
    autonomyLevel: 2 as Mission['autonomyLevel'],
    channels: ['youtube', 'telegram'],
    monetizationGoals: ['monthly_revenue'],
    constraints: {},
    successMetrics: {},
    status: 'draft' as CreativeMissionStatus,
    currentPhase: 'init',
    createdAt: FIXED_NOW_S,
    updatedAt: FIXED_NOW_S,
    ...overrides,
  };
}

function missionRowToDbRow(m: Mission) {
  return {
    id: m.id,
    workspace_id: m.workspaceId,
    creator_id: m.creatorId,
    brand_id: m.brandId,
    title: m.title,
    objective: m.objective,
    audience: m.audience,
    geography: m.geography,
    timeframe_start: m.timeframeStart,
    timeframe_end: m.timeframeEnd,
    budget_cents: m.budgetCents,
    spent_cents: m.spentCents,
    autonomy_level: m.autonomyLevel,
    channels: JSON.stringify(m.channels),
    monetization_goals: JSON.stringify(m.monetizationGoals),
    constraints: JSON.stringify(m.constraints),
    success_metrics: JSON.stringify(m.successMetrics),
    status: m.status,
    current_phase: m.currentPhase,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  };
}

describe('tree/mission', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── canTransition ─────────────────────────────────────────────────────────

  describe('canTransition', () => {
    it.each([
      ['draft → planned', 'draft', 'planned', true],
      ['planned → approval_required', 'planned', 'approval_required', true],
      ['approval_required → running', 'approval_required', 'running', true],
      ['running → paused', 'running', 'paused', true],
      ['running → review', 'running', 'review', true],
      ['running → completed', 'running', 'completed', true],
      ['paused → running', 'paused', 'running', true],
      ['paused → review', 'paused', 'review', true],
      ['review → completed', 'review', 'completed', true],
      ['review → iterating', 'review', 'iterating', true],
      ['completed → learning', 'completed', 'learning', true],
      ['learning → iterating', 'learning', 'iterating', true],
      ['iterating → draft', 'iterating', 'draft', true],
      ['iterating → planned', 'iterating', 'planned', true],
      ['iterating → running', 'iterating', 'running', true],
    ])('%s', (_label: string, from: string, to: string, expected: boolean) => {
      expect(canTransition(from as CreativeMissionStatus, to as CreativeMissionStatus)).toBe(expected);
    });

    it.each([
      ['draft → running (skip)', 'draft', 'running', false],
      ['draft → completed (skip)', 'draft', 'completed', false],
      ['planned → running (skip approval)', 'planned', 'running', false],
      // Pins the corrected state machine: pausing requires an execution
      // history, so a mission that was never run cannot pause.
      ['planned → paused (no execution yet)', 'planned', 'paused', false],
      ['approval_required → paused', 'approval_required', 'paused', false],
      ['review → paused', 'review', 'paused', false],
      ['completed → running', 'completed', 'running', false],
      ['learning → draft', 'learning', 'draft', false],
      ['unknown → any', 'unknown', 'draft', false],
    ])('%s is invalid', (_label: string, from: string, to: string, expected: boolean) => {
      expect(canTransition(from as CreativeMissionStatus, to as CreativeMissionStatus)).toBe(expected);
    });

    it('falls back to false for unknown target status', () => {
      expect(canTransition('draft', 'nonexistent' as CreativeMissionStatus)).toBe(false);
    });
  });

  // ── Execution-start rule ──────────────────────────────────────────────────

  describe('canStartExecution / EXECUTION_START_FROM', () => {
    it('allows start from exactly draft/planned/approval_required/paused', () => {
      expect([...EXECUTION_START_FROM].sort()).toEqual(
        ['approval_required', 'draft', 'paused', 'planned'].sort(),
      );
    });

    it.each(['draft', 'planned', 'approval_required', 'paused'] as const)(
      'canStartExecution: %s → true',
      (from) => {
        expect(canStartExecution(from)).toBe(true);
        expect(EXECUTION_START_FROM).toContain(from);
      },
    );

    it.each(['running', 'review', 'completed', 'learning', 'iterating'] as const)(
      'canStartExecution: %s → false',
      (from) => {
        expect(canStartExecution(from)).toBe(false);
      },
    );

    it('returns false for unknown status', () => {
      expect(canStartExecution('nonexistent' as CreativeMissionStatus)).toBe(false);
    });
  });

  // ── createMission ─────────────────────────────────────────────────────────

  describe('createMission', () => {
    it('inserts mission and returns it with generated id + timestamps', async () => {
      // createMission only calls INSERT (no SELECT) — returns the modified object
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            run: { success: true, meta: { changes: 1, duration: 1 } },
          }),
        ]),
      );

      const mission = missionRow();
      const result = await createMission(mission);
      expect(result.id).toBe('msn_fixed');
      expect(result.status).toBe('draft');
      expect(result.createdAt).toBe(FIXED_NOW_S);
      expect(result.updatedAt).toBe(FIXED_NOW_S);
    });

    it('throws D1_UNAVAILABLE when db is null', async () => {
      mocks.mockGetD1.mockReturnValue(null);
      const mission = missionRow();
      await expect(createMission(mission)).rejects.toThrow('D1 not available');
    });

    it('wraps thrown errors with INSERT_FAILED code', async () => {
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({
            run: async () => { throw new Error('Simulated DB error'); },
          }),
        ]),
      );
      const mission = missionRow();
      try {
        await createMission(mission);
        // should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error & { code?: string }).code).toBe('INSERT_FAILED');
        expect((err as Error).message).toContain('Simulated DB error');
      }
    });
  });

  // ── updateMissionStatus ───────────────────────────────────────────────────

  describe('updateMissionStatus', () => {
    it('allows valid transition and returns updated mission', async () => {
      const existing = missionRow({ status: 'draft' });
      const updated = missionRow({ status: 'planned', currentPhase: 'init' });

      // updateMissionStatus calls: getMission(SELECT), UPDATE.run(), getMission(SELECT)
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({ first: missionRowToDbRow(existing) }),
          stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
          stmt({ first: missionRowToDbRow(updated) }),
        ]),
      );

      const result = await updateMissionStatus(existing.id, 'planned', 'init');
      expect(result.status).toBe('planned');
    });

    it('throws when mission does not exist (NOT_FOUND)', async () => {
      mocks.mockGetD1.mockReturnValue(buildDb([stmt({ first: null })]));
      await expect(
        updateMissionStatus('msn_nonexistent', 'planned', 'init'),
      ).rejects.toThrow('Mission msn_nonexistent not found');
    });

    it('throws for disallowed status change (INVALID_TRANSITION)', async () => {
      const existing = missionRow({ status: 'draft' });
      mocks.mockGetD1.mockReturnValue(
        buildDb([stmt({ first: missionRowToDbRow(existing) })]),
      );

      // draft → completed is not in NEXT_STATUS, so canTransition returns false
      await expect(
        updateMissionStatus(existing.id, 'completed', 'init'),
      ).rejects.toThrow('draft → completed not allowed');
    });

    it('throws when run succeeds but fetch-after returns null (UPDATE_FAILED)', async () => {
      const existing = missionRow({ status: 'draft' });
      mocks.mockGetD1.mockReturnValue(
        buildDb([
          stmt({ first: missionRowToDbRow(existing) }),
          stmt({ run: { success: true, meta: { changes: 1, duration: 1 } } }),
          stmt({ first: null }),
        ]),
      );

      await expect(
        updateMissionStatus(existing.id, 'planned', 'init'),
      ).rejects.toThrow('Fetch after update failed');
    });
  });
});
