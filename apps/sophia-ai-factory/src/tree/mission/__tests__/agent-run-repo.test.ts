/**
 * Tests for tree/mission/agent-run-repo
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be hoisted — use vi.mock at module top
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { getD1 } from '@/seed/db/client';
import {
  createAgentRun,
  getAgentRun,
  listAgentRunsForMission,
  updateAgentRun,
  appendAgentLog,
  createApproval,
  getApproval,
  resolveApproval,
} from '../agent-run-repo';

const now = Math.floor(Date.now() / 1000);

const runRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'run-1',
  agent_id: 'agent-1',
  workspace_id: 'ws-1',
  mission_id: 'mission-1',
  created_at: now,
  started_at: now,
  ended_at: undefined,
  status: 'running',
  phase: 'executing',
  input_json: '{}',
  output_json: undefined,
  error_json: undefined,
  error_message: undefined,
  autonomy_level: 0,
  total_cost_cents: 0,
  total_tokens: 0,
  retry_count: 0,
  parent_run_id: undefined,
  metadata: undefined,
  ...overrides,
});

describe('agent-run-repo', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(getD1).mockReset();
  });

  describe('createAgentRun', () => {
    it('returns success with new run', async () => {
      vi.mocked(getD1).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockReturnValue(Promise.resolve({ meta: { changes: 1 } })),
            first: vi.fn().mockReturnValue(Promise.resolve(runRow())),
          }),
        }),
      } as unknown as ReturnType<typeof getD1>);

      const result = await createAgentRun({
        id: 'run-1',
        agentId: 'agent-1',
        workspaceId: 'ws-1',
        autonomyLevel: 0,
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('getAgentRun', () => {
    it('returns run when found', async () => {
      const row = runRow();
      vi.mocked(getD1).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockReturnValue(Promise.resolve(row)),
          }),
        }),
      } as unknown as ReturnType<typeof getD1>);

      const result = await getAgentRun('run-1');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value?.id).toBe('run-1');
    });

    it('returns null when not found', async () => {
      vi.mocked(getD1).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockReturnValue(Promise.resolve(null)),
          }),
        }),
      } as unknown as ReturnType<typeof getD1>);

      const result = await getAgentRun('missing');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBeNull();
    });
  });

  describe('listAgentRunsForMission', () => {
    it('queries scoped by mission AND workspace, newest first, honoring limit', async () => {
      let capturedSql = '';
      const bindMock = vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue(Promise.resolve({ results: [runRow()] })),
      });
      const prepareMock = vi.fn().mockImplementation((sql: string) => {
        capturedSql = sql;
        return { bind: bindMock };
      });
      vi.mocked(getD1).mockReturnValue({
        prepare: prepareMock,
      } as unknown as ReturnType<typeof getD1>);

      const result = await listAgentRunsForMission('mission-1', 'ws-1', 5);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.agentId).toBe('agent-1');
      expect(result.value[0]?.workspaceId).toBe('ws-1');
      expect(capturedSql).toContain('WHERE mission_id = ? AND workspace_id = ?');
      expect(capturedSql).toContain('ORDER BY created_at DESC LIMIT ?');
      expect(bindMock).toHaveBeenCalledWith('mission-1', 'ws-1', 5);
    });

    it('defaults limit to 10', async () => {
      const bindMock = vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue(Promise.resolve({ results: [] })),
      });
      vi.mocked(getD1).mockReturnValue({
        prepare: vi.fn().mockReturnValue({ bind: bindMock }),
      } as unknown as ReturnType<typeof getD1>);

      const result = await listAgentRunsForMission('mission-1', 'ws-1');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual([]);
      expect(bindMock).toHaveBeenCalledWith('mission-1', 'ws-1', 10);
    });

    it('returns DB_UNAVAILABLE when D1 is not available', async () => {
      vi.mocked(getD1).mockReturnValue(null as unknown as ReturnType<typeof getD1>);

      const result = await listAgentRunsForMission('mission-1', 'ws-1');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DB_UNAVAILABLE');
    });

    it('returns DB_ERROR when the query throws', async () => {
      vi.mocked(getD1).mockImplementation(() => {
        throw new Error('connection lost');
      });

      const result = await listAgentRunsForMission('mission-1', 'ws-1');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DB_ERROR');
    });
  });

  describe('resolveApproval', () => {
    it('returns ALREADY_RESOLVED when status is not pending', async () => {
      const firstMock = {
        first: vi.fn().mockReturnValue(Promise.resolve({ status: 'approved' })),
      };
      const runMock = {
        run: vi.fn().mockReturnValue(Promise.resolve({ meta: { changes: 1 } })),
      };

      const sharedDb = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('agent_approvals') && sql.includes('WHERE id')) {
            return { bind: vi.fn().mockReturnValue(firstMock) } as unknown as ReturnType<typeof getD1>;
          }
          if (sql.includes('UPDATE agent_approvals')) {
            return { bind: vi.fn().mockReturnValue(runMock) } as unknown as ReturnType<typeof getD1>;
          }
          return { bind: vi.fn().mockReturnValue(firstMock) } as unknown as ReturnType<typeof getD1>;
        }),
      } as unknown as ReturnType<typeof getD1>;

      vi.mocked(getD1).mockReturnValue(sharedDb);

      const result = await resolveApproval('approval-1', 'approved', 'user-1', 'ok');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('ALREADY_RESOLVED');
    });
  });
});