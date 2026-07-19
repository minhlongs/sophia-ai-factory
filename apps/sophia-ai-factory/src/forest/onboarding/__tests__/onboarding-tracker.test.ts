/**
 * Tests for OnboardingTracker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;
type QueryResult = { data: Row | Row[] | null };

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  bind: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>;
}

const store = {
  _extra: true as boolean,
  milestones: new Map<string, Row[]>(),
  tenants: new Map<string, Row>(),
};

function buildMockDb() {
  const from = vi.fn().mockImplementation((table: string): MockChain => {
    const allFn = vi.fn().mockReturnThis();
    const firstFn = vi.fn().mockReturnThis();
    const bindFn = vi.fn().mockReturnThis();
    const runFn = vi.fn().mockResolvedValue({ success: true });

    const chain: MockChain = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      maybeSingle: vi.fn(),
      order: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      all: allFn,
      first: firstFn,
      bind: bindFn,
      run: runFn,
      then: function(_onFulfilled?: (v: unknown) => unknown, _onRejected?: (e: unknown) => unknown) { return Promise.resolve({ data: [] }); },
    };
    let _pk: string | null = null;
    let _gteCol: string | null = null;
    let _gteVal: string | null = null;

    function computeRows(): Row[] {
      if (table === 'onboarding_progress') {
        if (_gteCol === 'achieved_at' && _gteVal !== null) {
          const cutoff = _gteVal;
          const seen = new Set<string>();
          const rows: Row[] = [];
          for (const [tid, ms] of store.milestones) {
            const hasRecent = ms.some((m) => typeof m.achieved_at === 'string' && m.achieved_at >= cutoff);
            if (hasRecent && !seen.has(tid)) { seen.add(tid); rows.push({ tenant_id: tid }); }
          }
          return rows;
        }
        if (_pk) return (store.milestones.get(_pk) ?? []).slice();
        return [];
      }
      if (table === 'tenants') {
        return _pk ? (store.tenants.get(_pk) !== undefined ? [store.tenants.get(_pk)!] : []) : [...store.tenants.values()];
      }
      return [];
    }

    chain.select.mockImplementation(() => chain);
    chain.eq.mockImplementation((_col: string, val: string) => { _pk = val; return chain; });
    chain.gte.mockImplementation((col: string, val: string) => { _gteCol = col; _gteVal = val; return chain; });
    chain.maybeSingle.mockImplementation((): QueryResult => {
      if (table === 'tenants') {
        const t = _pk ? store.tenants.get(_pk) : undefined;
        return { data: t ?? null };
      }
      const rows = _pk ? (store.milestones.get(_pk) ?? []) : [];
      return { data: rows.length > 0 ? rows[rows.length - 1] : null };
    });
    chain.order.mockImplementation(() => {
      const rows = _pk ? (store.milestones.get(_pk) ?? []).slice() : [];
      rows.sort((a, b) => String(a.achieved_at).localeCompare(String(b.achieved_at)));
      return { data: rows };
    });
    chain.upsert.mockImplementation((data: Row) => {
      const tenantId = String(data.tenant_id);
      const existing = store.milestones.get(tenantId) ?? [];
      const milestone = String(data.milestone);
      const idx = existing.findIndex((m) => m.milestone === milestone);
      const row = { tenant_id: tenantId, milestone, achieved_at: data.achieved_at, achieved_by: data.achieved_by, notes: data.notes ?? null };
      if (idx >= 0) existing[idx] = row;
      else existing.push(row);
      store.milestones.set(tenantId, existing);
      return chain;
    });
    chain.update.mockImplementation((data: Row) => {
      if (_pk && table === 'tenants') {
        const existing = store.tenants.get(_pk);
        if (existing) store.tenants.set(_pk, { ...existing, ...data });
      }
      return chain;
    });
    chain.all.mockImplementation((): QueryResult => ({ data: computeRows() }));
    chain.then = function(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason?: unknown) => unknown) {
      return Promise.resolve({ data: computeRows() }).then(onFulfilled, onRejected);
    };
    return chain;
  });

  const unwrap = vi.fn().mockReturnValue({
    prepare: vi.fn().mockImplementation((_sql: string): MockChain => {
      const allFn = vi.fn().mockReturnThis();
      const firstFn = vi.fn().mockReturnThis();
      const c: MockChain = {
        select: vi.fn(),
        eq: vi.fn(),
        gte: vi.fn(),
        maybeSingle: vi.fn(),
        order: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        all: allFn,
        then: function(_onFulfilled?: (v: unknown) => unknown, _onRejected?: (e: unknown) => unknown) { return Promise.resolve({ data: [] }); },
        bind: vi.fn().mockReturnThis(),
        first: firstFn,
        run: vi.fn().mockResolvedValue({ success: true }),
      };
      allFn.mockImplementation(() => ({ results: [] }));
      firstFn.mockImplementation(() => null);
      return c;
    }),
  });

  return { from, unwrap };
}

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(buildMockDb),
}));

import { OnboardingTracker } from '../onboarding-tracker';

describe('OnboardingTracker', () => {
  const TENANT_ID = 'tenant-test-001';
  const NOW = new Date().toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
    store.milestones.clear();
    store.tenants.clear();
    store.tenants.set(TENANT_ID, {
      id: TENANT_ID,
      onboarding_status: 'in_progress',
      onboarding_progress_pct: 0,
      onboarding_paused_reason: null,
      created_at: NOW,
    });
  });

  describe('recordMilestone', () => {
    it('should record a milestone', async () => {
      const tracker = new OnboardingTracker();
      const result = await tracker.recordMilestone(TENANT_ID, 'contract_signed', 'am-001');
      expect(result.success).toBe(true);
      expect(store.milestones.get(TENANT_ID)).toHaveLength(1);
    });

    it('should upsert on duplicate', async () => {
      const tracker = new OnboardingTracker();
      await tracker.recordMilestone(TENANT_ID, 'contract_signed', 'am-001');
      await tracker.recordMilestone(TENANT_ID, 'contract_signed', 'am-002', 'updated');
      expect(store.milestones.get(TENANT_ID)).toHaveLength(1);
    });

    it('should record multiple milestones', async () => {
      const tracker = new OnboardingTracker();
      await tracker.recordMilestone(TENANT_ID, 'contract_signed', 'am-001');
      await tracker.recordMilestone(TENANT_ID, 'kickoff_completed', 'am-001');
      expect(store.milestones.get(TENANT_ID)).toHaveLength(2);
    });
  });

  describe('getProgress', () => {
    it('should return null for no milestones', async () => {
      const tracker = new OnboardingTracker();
      const progress = await tracker.getProgress(TENANT_ID);
      expect(progress).toBeNull();
    });

    it('should return progress with milestones', async () => {
      store.milestones.set(TENANT_ID, [
        { tenant_id: TENANT_ID, milestone: 'contract_signed', achieved_at: NOW, achieved_by: 'am-001', notes: null },
        { tenant_id: TENANT_ID, milestone: 'kickoff_completed', achieved_at: NOW, achieved_by: 'am-001', notes: null },
      ]);
      const tracker = new OnboardingTracker();
      const progress = await tracker.getProgress(TENANT_ID);
      expect(progress).not.toBeNull();
      expect(progress!.milestones).toHaveLength(2);
      expect(progress!.currentPhase).toBe(1);
    });

    it('should detect at_risk when milestone is old', async () => {
      const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      store.milestones.set(TENANT_ID, [
        { tenant_id: TENANT_ID, milestone: 'contract_signed', achieved_at: oldDate, achieved_by: 'am-001', notes: null },
      ]);
      const tracker = new OnboardingTracker();
      const progress = await tracker.getProgress(TENANT_ID);
      expect(progress).not.toBeNull();
      expect(progress!.status).toBe('at_risk');
      expect(progress!.atRiskFlags.length).toBeGreaterThan(0);
    });

    it('should detect paused status', async () => {
      store.milestones.set(TENANT_ID, [
        { tenant_id: TENANT_ID, milestone: 'contract_signed', achieved_at: NOW, achieved_by: 'am-001', notes: null },
      ]);
      store.tenants.set(TENANT_ID, {
        ...store.tenants.get(TENANT_ID)!,
        onboarding_status: 'paused',
        onboarding_paused_reason: 'customer request',
      });
      const tracker = new OnboardingTracker();
      const progress = await tracker.getProgress(TENANT_ID);
      expect(progress).not.toBeNull();
      expect(progress!.status).toBe('paused');
    });

    it('should calculate daysRemaining', async () => {
      store.milestones.set(TENANT_ID, [
        { tenant_id: TENANT_ID, milestone: 'contract_signed', achieved_at: NOW, achieved_by: 'am-001', notes: null },
      ]);
      const tracker = new OnboardingTracker();
      const progress = await tracker.getProgress(TENANT_ID);
      expect(progress!.daysRemaining).toBeLessThanOrEqual(14);
      expect(progress!.daysRemaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAllActive', () => {
    it('should return active tenants', async () => {
      store.milestones.set(TENANT_ID, [
        { tenant_id: TENANT_ID, milestone: 'contract_signed', achieved_at: NOW, achieved_by: 'am-001', notes: null },
      ]);
      const tracker = new OnboardingTracker();
      const active = await tracker.getAllActive();
      expect(active.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when no active tenants', async () => {
      const tracker = new OnboardingTracker();
      const active = await tracker.getAllActive();
      expect(active).toEqual([]);
    });
  });

  describe('getAtRisk', () => {
    it('should return at-risk tenants', async () => {
      const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      store.milestones.set(TENANT_ID, [
        { tenant_id: TENANT_ID, milestone: 'contract_signed', achieved_at: oldDate, achieved_by: 'am-001', notes: null },
        { tenant_id: TENANT_ID, milestone: 'channels_connected', achieved_at: NOW, achieved_by: 'am-001', notes: null },
      ]);
      const tracker = new OnboardingTracker();
      const atRisk = await tracker.getAtRisk();
      expect(atRisk.length).toBeGreaterThanOrEqual(1);
      expect(atRisk[0].status).toBe('at_risk');
    });

    it('should return empty when no at-risk tenants', async () => {
      store.milestones.set(TENANT_ID, [
        { tenant_id: TENANT_ID, milestone: 'contract_signed', achieved_at: NOW, achieved_by: 'am-001', notes: null },
      ]);
      const tracker = new OnboardingTracker();
      const atRisk = await tracker.getAtRisk();
      expect(atRisk).toEqual([]);
    });
  });

  describe('pause / resume', () => {
    it('should pause onboarding', async () => {
      const tracker = new OnboardingTracker();
      const result = await tracker.pause(TENANT_ID, 'customer request');
      expect(result.success).toBe(true);
    });

    it('should resume onboarding', async () => {
      const tracker = new OnboardingTracker();
      const result = await tracker.resume(TENANT_ID);
      expect(result.success).toBe(true);
    });
  });
});
