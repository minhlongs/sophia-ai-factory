/** @module tree/budget/__tests__/budget-tracker.test */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BudgetTracker, BudgetMode, EntryStatus, BudgetExceededError, ApprovalRequiredError } from '@/tree/budget';
import Database from 'better-sqlite3';

// ── In-memory SQLite D1 mock ────────────────────────────────────────────────────

let db: ReturnType<typeof import('better-sqlite3')>;

function createMockD1Client() {
  db = new Database(':memory:');

  db.exec(`CREATE TABLE IF NOT EXISTS memory_kv (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'budget',
    key_name TEXT NOT NULL,
    value_json TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(tenant_id, type, key_name)
  )`);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
      return {
        bind(...vals: unknown[]) {
          stmt.bind(...vals);
          return this;
        },
        run(...vals: unknown[]) {
          const result = stmt.run(...vals);
          if (isInsert) {
            return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
          }
          return result;
        },
        all() {
          return { results: stmt.all() as Record<string, unknown>[] };
        },
        first() {
          const row = stmt.get() as Record<string, unknown> | undefined;
          return row ?? null;
        },
      } as never;
    },
    exec(sql: string) {
      db.exec(sql);
    },
  };
}

// ── Module mock ────────────────────────────────────────────────────────────────

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => createMockD1Client()),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const TENANT = 'tenant-budget-test';

function makeTracker(
  opts: {
    budgetTotalUsd?: number;
    reservePct?: number;
    singleActionApprovalUsd?: number;
    requireApprovalForNewPaidTool?: boolean;
    mode?: BudgetMode;
  } = {},
) {
  return new BudgetTracker(TENANT, {
    budgetTotalUsd: opts.budgetTotalUsd ?? 100,
    reservePct: opts.reservePct ?? 0.1,
    singleActionApprovalUsd: opts.singleActionApprovalUsd,
    requireApprovalForNewPaidTool: opts.requireApprovalForNewPaidTool ?? false,
    mode: opts.mode ?? BudgetMode.WARN,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BudgetTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── estimate / reserve / reconcile flow ─────────────────────────────────────

  describe('estimate / reserve / reconcile flow', () => {
    it('estimates a cost and returns an entry ID', () => {
      const tracker = makeTracker();
      const entryId = tracker.estimate('openrouter', 'chat', 0.25);
      expect(entryId).toBeTruthy();
      expect(typeof entryId).toBe('string');
    });

    it('reserves an estimated entry', () => {
      const tracker = makeTracker();
      const entryId = tracker.estimate('openrouter', 'chat', 0.25);
      expect(() => tracker.reserve(entryId)).not.toThrow();
    });

    it('reconcile marks completed entry with actual cost', () => {
      const tracker = makeTracker();
      const entryId = tracker.estimate('openrouter', 'chat', 0.25);
      tracker.reserve(entryId);
      tracker.reconcile(entryId, 0.18, true);

      const snapshot = tracker.costSnapshot();
      expect(snapshot.totalSpentUsd).toBeCloseTo(0.18, 4);
      expect(snapshot.totalReservedUsd).toBeCloseTo(0, 4);
    });

    it('reconcile marks failed entry with actual cost', () => {
      const tracker = makeTracker();
      const entryId = tracker.estimate('openrouter', 'chat', 0.30);
      tracker.reserve(entryId);
      tracker.reconcile(entryId, 0.05, false);

      const snapshot = tracker.costSnapshot();
      expect(snapshot.totalSpentUsd).toBeCloseTo(0.05, 4);
    });

    it('full lifecycle: estimate -> reserve -> reconcile (success)', () => {
      const tracker = makeTracker({ budgetTotalUsd: 10 });
      const entryId = tracker.estimate('elevenlabs', 'tts', 0.50);
      tracker.reserve(entryId);

      expect(tracker.budgetReservedUsd).toBeCloseTo(0.50, 4);

      tracker.reconcile(entryId, 0.42, true);

      expect(tracker.budgetReservedUsd).toBeCloseTo(0, 4);
      expect(tracker.budgetSpentUsd).toBeCloseTo(0.42, 4);
    });

    it('costSnapshot reflects budget math', () => {
      const tracker = makeTracker({ budgetTotalUsd: 50, singleActionApprovalUsd: 10.0 });
      const id1 = tracker.estimate('openrouter', 'chat', 1.0);
      tracker.reserve(id1);
      const id2 = tracker.estimate('elevenlabs', 'tts', 2.0);
      tracker.reserve(id2);

      const snapshot = tracker.costSnapshot();
      expect(snapshot.totalReservedUsd).toBeCloseTo(3.0, 4);
      expect(snapshot.budgetRemainingUsd).toBeCloseTo(47.0, 4);
      expect(snapshot.totalSpentUsd).toBeCloseTo(0, 4);
    });

    it('usableBudgetUsd accounts for reserve buffer', () => {
      const tracker = makeTracker({ budgetTotalUsd: 100, reservePct: 0.1 });
      expect(tracker.usableBudgetUsd).toBeCloseTo(90, 4);
    });

    it('usableBudgetUsd is zero when budget fully spent', () => {
      const tracker = makeTracker({ budgetTotalUsd: 10, reservePct: 0.1, singleActionApprovalUsd: 100.0 });
      const id = tracker.estimate('openrouter', 'chat', 10);
      tracker.reserve(id);
      tracker.reconcile(id, 10, true);

      expect(tracker.usableBudgetUsd).toBeCloseTo(0, 4);
    });
  });

  // ── Budget cap enforcement ───────────────────────────────────────────────────

  describe('budget cap enforcement', () => {
    it('CAP mode throws BudgetExceededError when reservation exceeds usable budget', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 10,
        reservePct: 0,
        mode: BudgetMode.CAP,
        singleActionApprovalUsd: 100,
      });
      const id = tracker.estimate('openrouter', 'chat', 15);
      expect(() => tracker.reserve(id)).toThrow(BudgetExceededError);
    });

    it('WARN mode logs but does not throw on overrun', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 10,
        reservePct: 0,
        mode: BudgetMode.WARN,
        singleActionApprovalUsd: 100,
      });
      const id = tracker.estimate('openrouter', 'chat', 15);
      expect(() => tracker.reserve(id)).not.toThrow();
    });

    it('OBSERVE mode never blocks', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 10,
        reservePct: 0,
        mode: BudgetMode.OBSERVE,
        singleActionApprovalUsd: 100,
      });
      const id = tracker.estimate('openrouter', 'chat', 100);
      expect(() => tracker.reserve(id)).not.toThrow();
    });

    it('CAP mode allows reservation within usable budget', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 100,
        reservePct: 0,
        mode: BudgetMode.CAP,
        singleActionApprovalUsd: 100,
      });
      const id = tracker.estimate('openrouter', 'chat', 25);
      expect(() => tracker.reserve(id)).not.toThrow();
    });

    it('reserve throws for unknown entry ID', () => {
      const tracker = makeTracker();
      expect(() => tracker.reserve('nonexistent-id')).toThrow();
    });
  });

  // ── Approval thresholds ──────────────────────────────────────────────────────

  describe('approval thresholds', () => {
    it('throws ApprovalRequiredError when single action exceeds threshold (WARN mode)', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 1000,
        singleActionApprovalUsd: 0.5,
        mode: BudgetMode.WARN,
      });
      const id = tracker.estimate('openrouter', 'chat', 1.0);
      expect(() => tracker.reserve(id)).toThrow(ApprovalRequiredError);
    });

    it('throws ApprovalRequiredError when single action exceeds threshold (CAP mode)', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 1000,
        singleActionApprovalUsd: 0.5,
        mode: BudgetMode.CAP,
      });
      const id = tracker.estimate('openrouter', 'chat', 1.0);
      expect(() => tracker.reserve(id)).toThrow(ApprovalRequiredError);
    });

    it('does not throw for actions within threshold', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 1000,
        singleActionApprovalUsd: 1.0,
        mode: BudgetMode.WARN,
      });
      const id = tracker.estimate('openrouter', 'chat', 0.25);
      expect(() => tracker.reserve(id)).not.toThrow();
    });

    it('OBSERVE mode skips approval threshold', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 1000,
        singleActionApprovalUsd: 0.5,
        mode: BudgetMode.OBSERVE,
      });
      const id = tracker.estimate('openrouter', 'chat', 5.0);
      expect(() => tracker.reserve(id)).not.toThrow();
    });

    it('new paid tool approval blocks first use', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 1000,
        singleActionApprovalUsd: 100,
        requireApprovalForNewPaidTool: true,
        mode: BudgetMode.WARN,
      });
      const id = tracker.estimate('new-tool', 'operation', 0.10);
      expect(() => tracker.reserve(id)).toThrow(ApprovalRequiredError);
    });

    it('approved tool does not trigger approval again', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 1000,
        singleActionApprovalUsd: 100,
        requireApprovalForNewPaidTool: true,
        mode: BudgetMode.WARN,
      });
      tracker.approveTool('openrouter');
      const id = tracker.estimate('openrouter', 'chat', 0.10);
      expect(() => tracker.reserve(id)).not.toThrow();
    });

    it('free tool (zero cost) does not require approval', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 1000,
        singleActionApprovalUsd: 0.5,
        requireApprovalForNewPaidTool: true,
        mode: BudgetMode.WARN,
      });
      const id = tracker.estimate('free-tool', 'noop', 0);
      expect(() => tracker.reserve(id)).not.toThrow();
    });
  });

  // ── Refund flow ──────────────────────────────────────────────────────────────

  describe('refund flow', () => {
    it('refund releases a reserved entry', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 10,
        reservePct: 0,
        singleActionApprovalUsd: 10.0,
      });
      const id = tracker.estimate('openrouter', 'chat', 3.0);
      tracker.reserve(id);

      expect(tracker.budgetReservedUsd).toBeCloseTo(3.0, 4);

      tracker.refund(id);

      expect(tracker.budgetReservedUsd).toBeCloseTo(0, 4);
      expect(tracker.budgetRemainingUsd).toBeCloseTo(10, 4);
    });

    it('refund restores usable budget for CAP mode', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 10,
        reservePct: 0,
        mode: BudgetMode.CAP,
        singleActionApprovalUsd: 10.0,
      });
      const id = tracker.estimate('openrouter', 'chat', 8.0);
      tracker.reserve(id);

      // Now usable is ~2 — a 3.0 request would fail
      const blockedId = tracker.estimate('openrouter', 'chat', 3.0);
      expect(() => tracker.reserve(blockedId)).toThrow(BudgetExceededError);

      // Refund the first
      tracker.refund(id);

      // Now 3.0 should fit
      expect(() => tracker.reserve(blockedId)).not.toThrow();
    });

    it('refund throws for unknown entry ID', () => {
      const tracker = makeTracker();
      expect(() => tracker.refund('nonexistent-id')).toThrow();
    });

    it('refunded entry releases reservation', () => {
      const tracker = makeTracker();
      const id = tracker.estimate('openrouter', 'chat', 0.5);
      tracker.reserve(id);
      tracker.refund(id);
      expect(tracker.budgetReservedUsd).toBeCloseTo(0, 4);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles zero-cost estimates', () => {
      const tracker = makeTracker();
      const id = tracker.estimate('free-tool', 'noop', 0);
      tracker.reserve(id);
      tracker.reconcile(id, 0, true);
      expect(tracker.budgetSpentUsd).toBeCloseTo(0, 4);
    });

    it('handles multiple sequential entries', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 100,
        reservePct: 0,
        singleActionApprovalUsd: 10.0,
      });
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = tracker.estimate('openrouter', 'chat', 5);
        ids.push(id);
        tracker.reserve(id);
      }

      expect(tracker.budgetReservedUsd).toBeCloseTo(25, 4);

      // Reconcile first 3
      for (let i = 0; i < 3; i++) {
        tracker.reconcile(ids[i]!, 5, true);
      }

      expect(tracker.budgetSpentUsd).toBeCloseTo(15, 4);
      expect(tracker.budgetReservedUsd).toBeCloseTo(10, 4);
    });

    it('reconcile after refund records actual cost', () => {
      const tracker = makeTracker();
      const id = tracker.estimate('openrouter', 'chat', 0.5);
      tracker.reserve(id);
      tracker.refund(id);
      tracker.reconcile(id, 0.3, true);
      expect(tracker.budgetSpentUsd).toBeCloseTo(0.3, 4);
    });

    it('estimate rounds to 4 decimal places', () => {
      const tracker = makeTracker();
      const id = tracker.estimate('openrouter', 'chat', 0.123456);
      tracker.reserve(id);
      expect(tracker.budgetReservedUsd).toBeCloseTo(0.1235, 4);
    });

    it('negative budget total produces negative remaining', () => {
      const tracker = makeTracker({ budgetTotalUsd: -10 });
      expect(tracker.budgetRemainingUsd).toBeCloseTo(-10, 4);
    });

    it('constructor accepts valid options', () => {
      const tracker = makeTracker({
        budgetTotalUsd: 500,
        reservePct: 0.15,
        singleActionApprovalUsd: 2.0,
        mode: BudgetMode.OBSERVE,
      });
      expect(tracker.budgetTotalUsd).toBe(500);
      expect(tracker.reservePct).toBeCloseTo(0.15, 4);
      expect(tracker.singleActionApprovalUsd).toBe(2.0);
      expect(tracker.requireApprovalForNewPaidTool).toBe(false);
      expect(tracker.mode).toBe(BudgetMode.OBSERVE);
    });
  });
});
