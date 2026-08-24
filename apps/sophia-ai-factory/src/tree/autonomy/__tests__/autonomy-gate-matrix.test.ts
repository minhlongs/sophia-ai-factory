/**
 * Autonomy Gate Matrix Tests
 *
 * Verifies the autonomy gate behavior across all 5 levels (0-4) for the
 * 'execute_agent' action and per-permission checks used by AgentExecutor.
 *
 * @module tree/autonomy/__tests__/autonomy-gate-matrix
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockStore, resetMockStore, mockRun, mockFirst, mockPrepare, mockGetD1, lastSql, lastBound } = vi.hoisted(() => {
  const mockStore = new Map<string, { row: Record<string, unknown>; ws: string }>();
  function resetMockStore() { mockStore.clear(); }
  const lastSql: { v: string } = { v: '' };
  const lastBound: { v: unknown[] } = { v: [] };
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

  return { mockStore, resetMockStore, mockRun, mockFirst, mockPrepare, mockGetD1, lastSql, lastBound };
});

vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));

import { isActionAllowed, checkActionAllowed, type AutonomyLevel } from '../autonomy-repo';

const WORKSPACE_ID = 'ws_gate_matrix_001';

function makeConfigRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'cfg-001', workspace_id: WORKSPACE_ID, agent_type: 'global', level: 1, overrides_json: '{}', created_at: 1000000, updated_at: 1000000, ...overrides };
}

describe('Autonomy Gate Matrix', () => {
  beforeEach(() => {
    resetMockStore();
    lastSql.v = '';
    lastBound.v = [];
    vi.clearAllMocks();
    mockGetD1.mockImplementation(() => ({ prepare: mockPrepare }));
    mockFirst.mockResolvedValue(null);
    mockRun.mockResolvedValue({ meta: { changes: 1 } });
  });

  const readOnly = ['read_mission', 'list_approvals', 'get_status', 'fetch_metrics', 'read_logs'];
  const blocked = ['spend_credits', 'delete_mission', 'update_billing', 'revoke_credentials', 'webhook_deregister'];
  const routine = ['create_content', 'publish', 'generate_text', 'analyze_metrics', 'schedule_post'];

  describe('execute_agent across autonomy levels (isActionAllowed)', () => {
    for (const [level, expected] of [[0, false], [1, false], [2, false], [3, true], [4, true]]) {
      it(`Level ${level}: ${expected ? 'ALLOWED' : 'DENIED'}`, async () => {
        mockFirst.mockResolvedValue(makeConfigRow({ level }));
        expect(await isActionAllowed(WORKSPACE_ID, 'execute_agent')).toBe(expected);
      });
    }
  });

  describe('execute_agent across autonomy levels (checkActionAllowed)', () => {
    for (const [level, expected] of [[0, false], [1, false], [2, false], [3, true], [4, true]] as const) {
      it(`Level ${level}: ${expected ? 'ALLOWED' : 'DENIED'}`, () => {
        expect(checkActionAllowed(level, 'execute_agent')).toBe(expected);
      });
    }
  });

  describe('per-permission checks consistency with level', () => {
    it('Level 2 allows all read-only actions', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 2 }));
      for (const a of readOnly) expect(await isActionAllowed(WORKSPACE_ID, a)).toBe(true);
    });

    it('Level 2 denies all non-read-only', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 2 }));
      for (const a of [...blocked, ...routine, 'execute_agent']) expect(await isActionAllowed(WORKSPACE_ID, a)).toBe(false);
    });

    it('Level 3 allows routine + read-only, blocks high-risk', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 3 }));
      for (const a of [...routine, ...readOnly]) expect(await isActionAllowed(WORKSPACE_ID, a)).toBe(true);
      for (const a of blocked) expect(await isActionAllowed(WORKSPACE_ID, a)).toBe(false);
    });

    it('Level 4 allows everything', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 4 }));
      for (const a of [...readOnly, ...routine, ...blocked, 'execute_agent']) expect(await isActionAllowed(WORKSPACE_ID, a)).toBe(true);
    });
  });

  describe('requiresApproval:false needs no approvedActionIds', () => {
    it('L3: generate_text (no approval) ALLOWED', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 3 }));
      expect(await isActionAllowed(WORKSPACE_ID, 'generate_text')).toBe(true);
    });

    it('L3: spend_credits (needs approval) BLOCKED by gate', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 3 }));
      expect(await isActionAllowed(WORKSPACE_ID, 'spend_credits')).toBe(false);
    });

    it('L4: spend_credits ALLOWED (no blocklist)', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 4 }));
      expect(await isActionAllowed(WORKSPACE_ID, 'spend_credits')).toBe(true);
    });
  });

  describe('blocklisted tools denied where applicable', () => {
    it('L3: blocked tools remain denied', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 3 }));
      for (const a of blocked) expect(await isActionAllowed(WORKSPACE_ID, a)).toBe(false);
    });

    it('L2: blocked tools denied', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 2 }));
      for (const a of blocked) expect(await isActionAllowed(WORKSPACE_ID, a)).toBe(false);
    });

    it('L4: blocked tools allowed', async () => {
      mockFirst.mockResolvedValue(makeConfigRow({ level: 4 }));
      for (const a of blocked) expect(await isActionAllowed(WORKSPACE_ID, a)).toBe(true);
    });
  });

  describe('agent-specific config fallback', () => {
    function buildFallbackDb(rows: Array<Record<string, unknown> | null>) {
      let call = 0;
      const self = {
        prepare(sql: string) {
          lastSql.v = sql;
          return {
            bind(...args: unknown[]) { lastBound.v = args; return self.prepare(sql); },
            first: async () => rows[Math.min(call++, rows.length - 1)],
            run: async () => ({ success: true, meta: { changes: 1 } }),
          };
        },
      };
      return self as unknown as ReturnType<typeof mockGetD1>;
    }

    it('agent-specific takes precedence over global', async () => {
      mockGetD1.mockReturnValue(buildFallbackDb([
        makeConfigRow({ agent_type: 'editor', level: 4 }),
        makeConfigRow({ agent_type: 'global', level: 1 }),
      ]));
      expect(await isActionAllowed(WORKSPACE_ID, 'execute_agent', 'editor')).toBe(true);
    });

    it('missing agent-specific falls back to global', async () => {
      mockGetD1.mockReturnValue(buildFallbackDb([
        null,
        makeConfigRow({ agent_type: 'global', level: 3 }),
      ]));
      expect(await isActionAllowed(WORKSPACE_ID, 'execute_agent', 'editor')).toBe(true);
    });
  });

  describe('DB unavailable → fail-closed', () => {
    it('D1 null → deny', async () => {
      mockGetD1.mockReturnValue(null as unknown as ReturnType<typeof mockGetD1>);
      expect(await isActionAllowed(WORKSPACE_ID, 'execute_agent')).toBe(false);
    });

    it('prepare throws → deny', async () => {
      mockGetD1.mockReturnValue({ prepare: vi.fn(() => { throw new Error('D1 binding not available'); }) });
      expect(await isActionAllowed(WORKSPACE_ID, 'execute_agent')).toBe(false);
    });
  });

  describe('out-of-range level → deny', () => {
    for (const lvl of [99, -1]) {
      it(`Level ${lvl} in DB → deny`, async () => {
        mockFirst.mockResolvedValue(makeConfigRow({ level: lvl }));
        expect(await isActionAllowed(WORKSPACE_ID, 'execute_agent')).toBe(false);
      });

      it(`checkActionAllowed(${lvl}) → deny`, () => {
        expect(checkActionAllowed(lvl as unknown as AutonomyLevel, 'execute_agent')).toBe(false);
      });
    }
  });
});