/**
 * Agent Factory — Runner unit tests
 * Mocks fetch (OpenRouter), repository, signals/track, reportError.
 * Phase 04: adds gate tests + reportError verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const TASK_ID = 'task-001';
const ORG_ID = 'org-001';
const AGENT_ID = 'agent-001';

const mockTask = {
  id: TASK_ID, orgId: ORG_ID, agentId: AGENT_ID,
  input: 'Say hello', output: null, status: 'queued' as const,
  errorMessage: null, tokensUsed: 0, costUsd: 0,
  createdAt: '2026-01-01', completedAt: null,
};

const mockAgent = {
  id: AGENT_ID, teamId: 'team-001', role: 'CEO' as const,
  name: 'CEO Agent', systemPrompt: 'You are CEO',
  model: 'openai/gpt-4o-mini', enabled: true, createdAt: '2026-01-01',
};

vi.mock('./repository', () => ({
  getTask: vi.fn().mockResolvedValue(mockTask),
  getAgentById: vi.fn().mockResolvedValue(mockAgent),
  updateTaskStatus: vi.fn().mockResolvedValue(undefined),
  updateTaskResult: vi.fn().mockResolvedValue(undefined),
  appendLog: vi.fn().mockResolvedValue({ id: 'log-001', taskId: TASK_ID, action: 'invoke', payload: {}, createdAt: '2026-01-01' }),
}));

vi.mock('@/tree/signals/track', () => ({
  track: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/tree/signals/ab-experiment', () => ({
  assignVariant: vi.fn().mockResolvedValue({ variant: 'control' }),
}));

vi.mock('@/land/telemetry/error-tracker', () => ({
  reportError: vi.fn().mockResolvedValue(undefined),
}));

describe('runAgent', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  it('calls OpenRouter and updates task on success (PREMIUM tier)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Hello from CEO' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { runAgent } = await import('./runner');
    const result = await runAgent(TASK_ID, ORG_ID, 'PREMIUM');

    expect(mockFetch).toHaveBeenCalledOnce();
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('openrouter.ai');
    expect(result).toBeDefined();
  });

  it('marks task as failed when OpenRouter returns error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: () => null },
      text: async () => JSON.stringify({ error: { message: 'Rate limited' } }),
      json: () => Promise.resolve({ error: { message: 'Rate limited' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { updateTaskResult } = await import('./repository');
    const { runAgent } = await import('./runner');

    await expect(runAgent(TASK_ID, ORG_ID, 'PREMIUM')).rejects.toThrow('Rate limited');
    expect(updateTaskResult).toHaveBeenCalledWith(
      TASK_ID,
      ORG_ID,
      expect.objectContaining({ status: 'failed' }),
    );
  }, 15000);

  it('marks task as failed when OPENROUTER_API_KEY missing', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const { updateTaskResult } = await import('./repository');
    const { runAgent } = await import('./runner');

    await expect(runAgent(TASK_ID, ORG_ID, 'PREMIUM')).rejects.toThrow('OPENROUTER_API_KEY');
    expect(updateTaskResult).toHaveBeenCalledWith(
      TASK_ID,
      ORG_ID,
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('appends invoke log on success', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Hi' } }],
        usage: { prompt_tokens: 5, completion_tokens: 5 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { appendLog } = await import('./repository');
    const { runAgent } = await import('./runner');
    await runAgent(TASK_ID, ORG_ID, 'PREMIUM');

    const calls = (appendLog as ReturnType<typeof vi.fn>).mock.calls;
    const invokeCall = calls.find((c: unknown[]) => (c[0] as { action: string }).action === 'invoke');
    expect(invokeCall).toBeDefined();
  });

  // Phase 04: Enforcement gate tests
  it('throws AgentTierBlockedError when BASIC tier tries CEO role', async () => {
    const { AgentTierBlockedError } = await import('./enforcement-gate');
    const { runAgent } = await import('./runner');

    await expect(runAgent(TASK_ID, ORG_ID, 'BASIC')).rejects.toBeInstanceOf(AgentTierBlockedError);
  });

  it('marks task failed with tier_blocked when gate rejects', async () => {
    const { updateTaskResult } = await import('./repository');
    const { runAgent } = await import('./runner');

    try {
      await runAgent(TASK_ID, ORG_ID, 'BASIC');
    } catch {
      // expected
    }
    expect(updateTaskResult).toHaveBeenCalledWith(
      TASK_ID,
      ORG_ID,
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('does NOT call fetch when gate blocks (no LLM cost)', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const { runAgent } = await import('./runner');
    try {
      await runAgent(TASK_ID, ORG_ID, 'BASIC');
    } catch {
      // expected
    }
    // fetch should not have been called (gate fired before LLM)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls reportError on LLM network failure', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));
    vi.stubGlobal('fetch', mockFetch);

    const { reportError } = await import('@/land/telemetry/error-tracker');
    const { runAgent } = await import('./runner');

    await expect(runAgent(TASK_ID, ORG_ID, 'PREMIUM')).rejects.toThrow('Network timeout');
    // reportError called (may be void — just check it was invoked)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ route: 'agent.runner', agent_role: 'CEO' }),
    );
  }, 25000);

  it('MASTER tier bypasses gate and proceeds to LLM', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'MASTER output' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { runAgent } = await import('./runner');
    const result = await runAgent(TASK_ID, ORG_ID, 'MASTER');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toBeDefined();
  });
});
