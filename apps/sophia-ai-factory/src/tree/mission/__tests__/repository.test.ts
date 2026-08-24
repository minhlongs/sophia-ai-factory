/**
 * Mission repository guarded-write tests — DB-backed via D1 shim.
 *
 * Covers: beginMissionExecution happy path + NOT_FOUND + EXECUTION_START_INVALID
 *         + CONCURRENT_MODIFICATION (race injection via real SQLite)
 *         Hardened updateMissionStatus: concurrent-modification rejection;
 *         prior valid cases still green (regression).
 *
 * Uses shared real-SQLite D1 shim @/__tests__/integration/shared-d1-shim.
 *
 * @module tree/mission/__tests__/repository
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1, SCHEMA, mockGetD1 } from '@/__tests__/integration/shared-d1-shim';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (p: string) => {
    exec(s: string): void;
    prepare(s: string): {
      get(...p: unknown[]): unknown;
      all(...p: unknown[]): unknown[];
      run(...p: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

const { getD1 } = await import('@/seed/db/client');
vi.mock('@/seed/db/client', () => ({ getD1: vi.fn() }));

beforeEach(() => {
  vi.mocked(getD1).mockReset();
});

function setupDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return makeD1(db);
}

/**
 * Wrap the real-SQLite D1 shim so that, immediately before the guarded
 * mission-status UPDATE executes, a competing writer flips the row's status.
 * This reproduces the exact race the optimistic guard defends against:
 * the caller read status X, another writer commits status Y, then the
 * caller's `UPDATE ... WHERE status = X` matches 0 rows → changes === 0.
 */
function makeRacingD1(db: InstanceType<typeof DatabaseSync>, raceStatus: string) {
  const base = makeD1(db);
  return {
    ...base,
    prepare(sql: string) {
      const isGuardedUpdate =
        sql.includes('UPDATE creative_missions SET status') && sql.includes('AND status = ?');
      const stmt = base.prepare(sql);
      if (!isGuardedUpdate) return stmt;
      // Locate the id bind position: count '?' placeholders before 'WHERE id'.
      const whereIdx = sql.indexOf('WHERE id');
      const idParamIdx = sql.slice(0, whereIdx).split('?').length - 1;
      return {
        bind: (...params: unknown[]) => {
          const bound = stmt.bind(...params);
          return {
            ...bound,
            run: async () => {
              // Competing writer wins the race just before this stale write lands.
              await base
                .prepare(`UPDATE creative_missions SET status = ?, updated_at = ? WHERE id = ?`)
                .bind(raceStatus, Math.floor(Date.now() / 1000), params[idParamIdx])
                .run();
              return bound.run();
            },
          };
        },
      };
    },
  };
}

/** Minimal D1 surface used by insertMission — accepts both the plain shim and the racing wrapper. */
type D1Like = {
  prepare(sql: string): { bind(...params: unknown[]): { run(): Promise<unknown> } };
};

async function insertMission(d1: D1Like, row: Record<string, unknown>) {
  await d1
    .prepare(
      `INSERT INTO creative_missions
         (id, workspace_id, creator_id, brand_id, title, objective, audience, geography,
          timeframe_start, timeframe_end, budget_cents, spent_cents, autonomy_level,
          channels, monetization_goals, constraints, success_metrics,
          status, current_phase, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.workspace_id,
      row.creator_id,
      row.brand_id ?? null,
      row.title,
      row.objective,
      row.audience,
      row.geography,
      row.timeframe_start ?? 0,
      row.timeframe_end ?? 0,
      row.budget_cents ?? 0,
      row.spent_cents ?? 0,
      row.autonomy_level ?? 3,
      JSON.stringify(row.channels ?? []),
      JSON.stringify(row.monetization_goals ?? []),
      JSON.stringify(row.constraints ?? {}),
      JSON.stringify(row.success_metrics ?? {}),
      row.status ?? 'draft',
      row.current_phase ?? 'init',
      row.created_at ?? 100,
      row.updated_at ?? 100,
    )
    .run();
}

describe('tree/mission — repository guarded writes', () => {
  // ── beginMissionExecution ──────────────────────────────────────────────────

  describe('beginMissionExecution', () => {
    it('happy path: flips status to running and phase to executing', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_happy',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'draft',
        current_phase: 'init',
      });

      const { beginMissionExecution } = await import('@/tree/mission/types');
      const result = await beginMissionExecution('msn_happy');

      expect(result.status).toBe('running');
      expect(result.currentPhase).toBe('executing');
    });

    it('throws NOT_FOUND when mission does not exist', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      const { beginMissionExecution } = await import('@/tree/mission/types');
      await expect(beginMissionExecution('ghost')).rejects.toMatchObject({
        name: 'MissionError',
        code: 'NOT_FOUND',
      });
    });

    it('throws EXECUTION_START_INVALID when starting from review', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_review',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'review',
        current_phase: 'review',
      });

      const { beginMissionExecution } = await import('@/tree/mission/types');
      await expect(beginMissionExecution('msn_review')).rejects.toMatchObject({
        name: 'MissionError',
        code: 'EXECUTION_START_INVALID',
      });
    });

    it('throws EXECUTION_START_INVALID when starting from completed', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_completed',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'completed',
        current_phase: 'completed',
      });

      const { beginMissionExecution } = await import('@/tree/mission/types');
      await expect(beginMissionExecution('msn_completed')).rejects.toMatchObject({
        name: 'MissionError',
        code: 'EXECUTION_START_INVALID',
      });
    });

    it('throws CONCURRENT_MODIFICATION when race injection occurs (stale write)', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec(SCHEMA);
      // Racing writer flips the row to 'running' right before the guarded UPDATE,
      // so the caller's WHERE status='draft' matches 0 rows.
      const d1 = makeRacingD1(db, 'running');
      mockGetD1(d1 as ReturnType<typeof makeD1>);

      await insertMission(d1, {
        id: 'msn_race',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'draft',
        current_phase: 'init',
      });

      const { beginMissionExecution } = await import('@/tree/mission/types');

      // Caller reads status='draft', passes canStartExecution, then the racing
      // writer commits status='running' before the guarded UPDATE lands.
      // WHERE status='draft' matches 0 rows → CONCURRENT_MODIFICATION.
      await expect(beginMissionExecution('msn_race')).rejects.toMatchObject({
        name: 'MissionError',
        code: 'CONCURRENT_MODIFICATION',
      });
    });

    it('throws EXECUTION_START_INVALID when starting from running', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_running',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'running',
        current_phase: 'executing',
      });

      const { beginMissionExecution } = await import('@/tree/mission/types');
      await expect(beginMissionExecution('msn_running')).rejects.toMatchObject({
        name: 'MissionError',
        code: 'EXECUTION_START_INVALID',
      });
    });

    it('throws EXECUTION_START_INVALID when starting from learning', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_learning',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'learning',
        current_phase: 'learning',
      });

      const { beginMissionExecution } = await import('@/tree/mission/types');
      await expect(beginMissionExecution('msn_learning')).rejects.toMatchObject({
        name: 'MissionError',
        code: 'EXECUTION_START_INVALID',
      });
    });

    it('allows start from paused (valid execution start state)', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_paused',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'paused',
        current_phase: 'paused',
      });

      const { beginMissionExecution } = await import('@/tree/mission/types');
      const result = await beginMissionExecution('msn_paused');

      expect(result.status).toBe('running');
      expect(result.currentPhase).toBe('executing');
    });

    it('allows start from approval_required (valid execution start state)', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_approval',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'approval_required',
        current_phase: 'approval',
      });

      const { beginMissionExecution } = await import('@/tree/mission/types');
      const result = await beginMissionExecution('msn_approval');

      expect(result.status).toBe('running');
      expect(result.currentPhase).toBe('executing');
    });
  });

  // ── updateMissionStatus hardened (optimistic guard) ─────────────────────────

  describe('updateMissionStatus — optimistic concurrency guard', () => {
    it('rejects stale write with CONCURRENT_MODIFICATION (race: status changed by another writer)', async () => {
      const db = new DatabaseSync(':memory:');
      db.exec(SCHEMA);
      // Racing writer flips the row to 'running' right before the guarded UPDATE,
      // so the caller's WHERE status='draft' matches 0 rows.
      const d1 = makeRacingD1(db, 'running');
      mockGetD1(d1 as ReturnType<typeof makeD1>);

      await insertMission(d1, {
        id: 'msn_guard',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'draft',
        current_phase: 'init',
      });

      const { updateMissionStatus } = await import('@/tree/mission/types');

      // Caller reads status='draft', validates draft→planned OK, then the guarded
      // UPDATE runs. The racing writer has already committed status='running', so
      // WHERE status='draft' matches 0 rows → meta.changes===0 → CONCURRENT_MODIFICATION.
      await expect(
        updateMissionStatus('msn_guard', 'planned', 'init')
      ).rejects.toMatchObject({
        name: 'MissionError',
        code: 'CONCURRENT_MODIFICATION',
      });
    });

    it('valid transition still works (regression: draft → planned)', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_valid1',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'draft',
        current_phase: 'init',
      });

      const { updateMissionStatus } = await import('@/tree/mission/types');
      const result = await updateMissionStatus('msn_valid1', 'planned', 'init');
      expect(result.status).toBe('planned');
    });

    it('valid transition still works (regression: running → review)', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_valid2',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'running',
        current_phase: 'executing',
      });

      const { updateMissionStatus } = await import('@/tree/mission/types');
      const result = await updateMissionStatus('msn_valid2', 'review', 'review');
      expect(result.status).toBe('review');
      expect(result.currentPhase).toBe('review');
    });

    it('valid transition still works (regression: review → completed)', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_valid3',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'review',
        current_phase: 'review',
      });

      const { updateMissionStatus } = await import('@/tree/mission/types');
      const result = await updateMissionStatus('msn_valid3', 'completed', 'completed');
      expect(result.status).toBe('completed');
    });

    it('valid transition still works (regression: paused → running)', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_valid4',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'paused',
        current_phase: 'paused',
      });

      const { updateMissionStatus } = await import('@/tree/mission/types');
      const result = await updateMissionStatus('msn_valid4', 'running', 'executing');
      expect(result.status).toBe('running');
      expect(result.currentPhase).toBe('executing');
    });

    it('throws NOT_FOUND for non-existent mission', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      const { updateMissionStatus } = await import('@/tree/mission/types');
      await expect(
        updateMissionStatus('ghost', 'planned', 'init')
      ).rejects.toMatchObject({
        name: 'MissionError',
        code: 'NOT_FOUND',
      });
    });

    it('throws INVALID_TRANSITION for disallowed transition (draft → completed)', async () => {
      const d1 = setupDb();
      mockGetD1(d1);

      await insertMission(d1, {
        id: 'msn_invalid',
        workspace_id: 'ws',
        creator_id: 'u',
        title: 'Test',
        objective: 'O',
        audience: 'A',
        geography: 'G',
        status: 'draft',
        current_phase: 'init',
      });

      const { updateMissionStatus } = await import('@/tree/mission/types');
      await expect(
        updateMissionStatus('msn_invalid', 'completed', 'init')
      ).rejects.toMatchObject({
        name: 'MissionError',
        code: 'INVALID_TRANSITION',
      });
    });
  });
});