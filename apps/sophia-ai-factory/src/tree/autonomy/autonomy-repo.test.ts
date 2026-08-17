/**
 * Autonomy Repository Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAutonomyConfig,
  setAutonomyLevel,
  isActionAllowed,
} from './autonomy-repo';

const { mockStore, resetMockStore, mockBind, mockRun, mockFirst, mockPrepare, mockGetD1, lastSql, lastBound } = vi.hoisted(() => {
  const mockStore = new Map<string, { row: Record<string, unknown>; ws: string }>();
  function resetMockStore() { mockStore.clear(); }
  const lastSql: { v: string } = { v: '' };
  const lastBound: { v: unknown[] } = { v: [] };
  const mockBind = vi.fn().mockReturnThis();
  const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const mockFirst = vi.fn().mockResolvedValue(null);
  const mockPrepare = vi.fn((sql: string) => {
    lastSql.v = sql;
    return {
      bind(...args: unknown[]) { lastBound.v = args; return this; },
      run() { return Promise.resolve(mockRun()); },
      first() { return Promise.resolve(mockFirst() as Record<string, unknown> | null); },
    };
  });
  const mockGetD1 = vi.fn(() => ({ prepare: mockPrepare }));

  mockRun.mockImplementation(async () => {
    if (lastSql.v.includes('INSERT INTO autonomy_configs')) {
      const a = lastBound.v;
      const id = String(a[0]), ws = String(a[1]);
      mockStore.set(id, { ws, row: { id, workspace_id: ws, agent_type: a[2], level: a[3], overrides_json: a[4], created_at: a[5], updated_at: a[6] } });
    } else if (lastSql.v.includes('UPDATE autonomy_configs')) {
      const a = lastBound.v;
      const id = String(a[1]), ws = String(a[2]);
      const e = mockStore.get(id);
      if (e?.ws === ws) { e.row.level = a[0]; e.row.updated_at = a[3]; }
    }
    return { success: true, meta: { changes: 1 } };
  });

  mockFirst.mockImplementation(async () => {
    if (lastSql.v.includes('workspace_id = ?1 AND agent_type = ?2')) {
      const a = lastBound.v;
      const e = mockStore.get(String(a[0]) + ':' + String(a[1]));
      return e?.row ?? null;
    }
    if (lastSql.v.includes('workspace_id = ?1')) {
      const a = lastBound.v;
      const e = mockStore.get(String(a[0]) + ':global');
      return e?.row ?? null;
    }
    return null;
  });

  return { mockStore, resetMockStore, mockBind, mockRun, mockFirst, mockPrepare, mockGetD1, lastSql, lastBound };
});

vi.mock('@/seed/db/client', () => ({
  getD1: mockGetD1,
}));

const WORKSPACE_ID = 'ws_test_001';

function makeConfigRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cfg-001',
    workspace_id: WORKSPACE_ID,
    agent_type: 'global',
    level: 1,
    overrides_json: '{}',
    created_at: 1000000,
    updated_at: 1000000,
    ...overrides,
  };
}

describe('AutonomyRepo', () => {
  beforeEach(() => {
    resetMockStore();
    lastSql.v = '';
    lastBound.v = [];
    vi.clearAllMocks();
    mockGetD1.mockImplementation(() => ({ prepare: mockPrepare }));
    mockFirst.mockResolvedValue(null);
    mockRun.mockResolvedValue({ meta: { changes: 1 } });
  });

  describe('getAutonomyConfig', () => {
    it('returns default when no row exists', async () => {
      mockFirst.mockResolvedValue(null);
      const result = await getAutonomyConfig(WORKSPACE_ID);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.level).toBe(1);
      expect(result.value.agentType).toBe('global');
    });

    it('returns stored row when it exists', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 3 }));
      const result = await getAutonomyConfig(WORKSPACE_ID, 'global');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.level).toBe(3);
    });

    it('falls back to global config when agent-specific config missing', async () => {
      mockFirst.mockImplementation(async () => {
        if (lastSql.v.includes('agent_type = ?2')) return Promise.resolve(null);
        return Promise.resolve(makeConfigRow({ level: 2, agent_type: 'global' }));
      });
      const result = await getAutonomyConfig(WORKSPACE_ID, 'editor');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.level).toBe(2);
    });

    it('returns failure when D1 is unavailable', async () => {
      mockGetD1.mockReturnValue(null as unknown as ReturnType<typeof mockGetD1>);
      const result = await getAutonomyConfig(WORKSPACE_ID);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DB_UNAVAILABLE');
    });
  });

  describe('setAutonomyLevel', () => {
    it('inserts a new row', async () => {
      mockFirst.mockResolvedValue(null);
      const result = await setAutonomyLevel(WORKSPACE_ID, 2, 'editor');
      expect(result.ok).toBe(true);
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO autonomy_configs'),
      );
    });

    it('rejects level outside 0-4', async () => {
      const result = await setAutonomyLevel(WORKSPACE_ID, 5, 'global');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DB_ERROR');
      expect((result.error as { message: string }).message).toContain('Must be 0-4');
    });

    it('returns failure when D1 is unavailable', async () => {
      mockGetD1.mockReturnValue(null as unknown as ReturnType<typeof mockGetD1>);
      const result = await setAutonomyLevel(WORKSPACE_ID, 2);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DB_UNAVAILABLE');
    });
  });

  describe('isActionAllowed', () => {
    it('returns false for level 0 (Manual)', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 0 }));
      expect(await isActionAllowed(WORKSPACE_ID, 'any_action')).toBe(false);
    });

    it('returns false for level 1 (Suggest)', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 1 }));
      expect(await isActionAllowed(WORKSPACE_ID, 'any_action')).toBe(false);
    });

    it('allows read-only actions at level 2 (Semi-auto)', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 2 }));
      expect(await isActionAllowed(WORKSPACE_ID, 'read_mission')).toBe(true);
      expect(await isActionAllowed(WORKSPACE_ID, 'get_status')).toBe(true);
      expect(await isActionAllowed(WORKSPACE_ID, 'spend_credits')).toBe(false);
    });

    it('blocks high-risk actions at level 3 (Auto)', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 3 }));
      expect(await isActionAllowed(WORKSPACE_ID, 'spend_credits')).toBe(false);
      expect(await isActionAllowed(WORKSPACE_ID, 'delete_mission')).toBe(false);
      expect(await isActionAllowed(WORKSPACE_ID, 'list_approvals')).toBe(true);
    });

    it('allows all actions at level 4 (Full)', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 4 }));
      expect(await isActionAllowed(WORKSPACE_ID, 'spend_credits')).toBe(true);
      expect(await isActionAllowed(WORKSPACE_ID, 'delete_mission')).toBe(true);
    });

    it('returns false when D1 is unavailable', async () => {
      mockGetD1.mockReturnValue(null as unknown as ReturnType<typeof mockGetD1>);
      expect(await isActionAllowed(WORKSPACE_ID, 'any_action')).toBe(false);
    });
  });
});
