/**
 * Agent Factory — Repository unit tests
 * Mocks createServerClient to avoid real D1 binding.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Types ──────────────────────────────────────────────────────────────────

import type { AgentTeam, Agent, AgentTask, AgentLog } from './types';

// ── Mock helpers ──────────────────────────────────────────────────────────

const ORG_ID = 'org-test-001';
const TEAM_ID = 'team-test-001';
const AGENT_ID = 'agent-test-001';
const TASK_ID = 'task-test-001';

const TEAM_ROW = { id: TEAM_ID, org_id: ORG_ID, name: 'My AI Company', config: '{}', created_at: '2026-01-01', updated_at: '2026-01-01' };
const AGENT_ROW = { id: AGENT_ID, team_id: TEAM_ID, role: 'CEO', name: 'CEO Agent', system_prompt: 'You are CEO', model: 'openai/gpt-4o-mini', enabled: 1, created_at: '2026-01-01' };
const TASK_ROW = { id: TASK_ID, org_id: ORG_ID, agent_id: AGENT_ID, input: 'hello', output: null, status: 'queued', error_message: null, tokens_used: 0, cost_usd: 0, created_at: '2026-01-01', completed_at: null };
const LOG_ROW = { id: 'log-001', task_id: TASK_ID, action: 'invoke', payload: '{"tokens":10}', created_at: '2026-01-01' };

function makeChain(singleData: unknown = null, listData: unknown[] = []) {
  const self = {
    select: () => self,
    insert: () => self,
    update: () => self,
    eq: () => self,
    order: () => self,
    limit: () => self,
    range: () => self,
    single: () => Promise.resolve({ data: singleData, error: null }),
    maybeSingle: () => Promise.resolve({ data: singleData, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null; count: null }) => unknown) =>
      resolve({ data: listData, error: null, count: null }),
  };
  return self;
}

function makeDb(singleData: unknown = null, listData: unknown[] = []) {
  return { from: () => makeChain(singleData, listData) };
}

vi.mock('@/lib/db/client', () => ({
  createServerClient: vi.fn(),
}));

// ── Tests ─────────────────────────────────────────────────────────────────

describe('repository: getTeamByOrgId', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns mapped AgentTeam when row found', async () => {
    const { createServerClient } = await import('@/lib/db/client');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb(TEAM_ROW));

    const { getTeamByOrgId } = await import('./repository');
    const team = await getTeamByOrgId(ORG_ID) as AgentTeam;
    expect(team).not.toBeNull();
    expect(team.orgId).toBe(ORG_ID);
    expect(team.name).toBe('My AI Company');
    expect(team.config).toEqual({});
  });

  it('returns null when no row found', async () => {
    const { createServerClient } = await import('@/lib/db/client');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb(null));

    const { getTeamByOrgId } = await import('./repository');
    const team = await getTeamByOrgId('nonexistent');
    expect(team).toBeNull();
  });
});

describe('repository: getAgentById', () => {
  beforeEach(() => { vi.resetModules(); });

  it('maps agent row correctly', async () => {
    const { createServerClient } = await import('@/lib/db/client');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb(AGENT_ROW));

    const { getAgentById } = await import('./repository');
    const agent = await getAgentById(AGENT_ID) as Agent;
    expect(agent.role).toBe('CEO');
    expect(agent.enabled).toBe(true); // enabled: 1 → true
    expect(agent.teamId).toBe(TEAM_ID);
  });
});

describe('repository: getTask', () => {
  beforeEach(() => { vi.resetModules(); });

  it('maps task row correctly', async () => {
    const { createServerClient } = await import('@/lib/db/client');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb(TASK_ROW));

    const { getTask } = await import('./repository');
    const task = await getTask(TASK_ID, ORG_ID) as AgentTask;
    expect(task.status).toBe('queued');
    expect(task.output).toBeNull();
    expect(task.orgId).toBe(ORG_ID);
  });
});

describe('repository: listAgents', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns array of agents', async () => {
    const { createServerClient } = await import('@/lib/db/client');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb(null, [AGENT_ROW]));

    const { listAgents } = await import('./repository');
    const agents = await listAgents(TEAM_ID) as Agent[];
    expect(Array.isArray(agents)).toBe(true);
    expect(agents[0]?.role).toBe('CEO');
  });

  it('returns empty array when no rows', async () => {
    const { createServerClient } = await import('@/lib/db/client');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb(null, []));

    const { listAgents } = await import('./repository');
    const agents = await listAgents(TEAM_ID);
    expect(agents).toEqual([]);
  });
});

describe('repository: appendLog', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns AgentLog on success', async () => {
    const { createServerClient } = await import('@/lib/db/client');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDb(LOG_ROW));

    const { appendLog } = await import('./repository');
    const log = await appendLog({ taskId: TASK_ID, action: 'invoke', payload: { tokens: 10 } }) as AgentLog;
    expect(log.action).toBe('invoke');
    expect(log.taskId).toBe(TASK_ID);
    expect(log.payload).toEqual({ tokens: 10 });
  });
});
