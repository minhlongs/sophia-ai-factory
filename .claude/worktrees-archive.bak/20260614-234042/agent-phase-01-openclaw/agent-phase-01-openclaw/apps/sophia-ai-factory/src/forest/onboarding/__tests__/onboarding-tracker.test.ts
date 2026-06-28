/**
 * Tests for OnboardingTracker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = {
  _extra: true as boolean,
  milestones: new Map<string, { milestone: string; achieved_at: string; achieved_by: string; notes: string | null; tenant_id?: string }[]>(),
  tenants: new Map<string, { id?: string; onboarding_status: string; onboarding_progress_pct: number; onboarding_paused_reason: string | null; created_at: string }>(),
};

function buildMockDb() {
  const from = vi.fn().mockImplementation((table: string) => {
    const chain: any = {};
    let _pk: string | null = null;
    let _gteCol: string | null = null;
    let _gteVal: string | null = null;

    function computeRows(): any[] {
      if (table === 'onboarding_progress') {
        if (_gteCol === 'achieved_at' && _gteVal !== null) {
          const cutoff = _gteVal;
          const seen = new Set<string>();
          const rows: any[] = [];
          for (const [tid, ms] of store.milestones) {
            const hasRecent = ms.some((m: any) => m.achieved_at >= cutoff);
            if (hasRecent && !seen.has(tid)) { seen.add(tid); rows.push({ tenant_id: tid }); }
          }
          return rows;
        }
        if (_pk) return (store.milestones.get(_pk) ?? []).slice();
        return [];
      }
      if (table === 'tenants') {
        return _pk ? [store.tenants.get(_pk)].filter(Boolean) : [...store.tenants.values()];
      }
      return [];
    }

    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockImplementation((_col: string, val: any) => { _pk = val; return chain; });
    chain.gte = vi.fn().mockImplementation((col: string, val: string) => { _gteCol = col; _gteVal = val; return chain; });
    chain.maybeSingle = vi.fn().mockImplementation(() => {
      if (table === 'tenants') {
        const t = _pk ? store.tenants.get(_pk) : null;
        return { data: t ?? null };
      }
      const rows = _pk ? (store.milestones.get(_pk) ?? []) : [];
      return { data: rows.length > 0 ? rows[rows.length - 1] : null };
    });
    chain.order = vi.fn().mockImplementation(() => {
      const rows = _pk ? (store.milestones.get(_pk) ?? []).slice() : [];
      rows.sort((a: any, b: any) => a.achieved_at.localeCompare(b.achieved_at));
      return { data: rows };
    });
    chain.upsert = vi.fn().mockImplementation((data: any) => {
      const existing = store.milestones.get(data.tenant_id) ?? [];
      const idx = existing.findIndex((m: any) => m.milestone === data.milestone);
      const row = { tenant_id: data.tenant_id, milestone: data.milestone, achieved_at: data.achieved_at, achieved_by: data.achieved_by, notes: data.notes ?? null };
      if (idx >= 0) existing[idx] = row;
      else existing.push(row);
      store.milestones.set(data.tenant_id, existing);
      return chain;
    });
    chain.update = vi.fn().mockImplementation((data: any) => {
      if (_pk && table === 'tenants') {
        const existing = store.tenants.get(_pk);
        if (existing) store.tenants.set(_pk, { ...existing, ...data });
      }
      return chain;
    });
    chain.all = vi.fn().mockImplementation(() => ({ data: computeRows() }));
    // D1QueryChain is thenable — await calls .then(), not .all()
    chain.then = function(onFulfilled: any, onRejected: any) {
      return Promise.resolve({ data: computeRows() }).then(onFulfilled, onRejected);
    };
    return chain;
  });

  const unwrap = vi.fn().mockReturnValue({
    prepare: vi.fn().mockImplementation((_sql: string) => {
      const c: any = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockReturnThis(),
        first: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };
      c.all.mockImplementation(() => ({ results: [] }));
      c.first.mockImplementation(() => null);
      return c;
    }),
  });

  return { from, unwrap };
}

vi.mock('@/seed/db/client', () => ({
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
