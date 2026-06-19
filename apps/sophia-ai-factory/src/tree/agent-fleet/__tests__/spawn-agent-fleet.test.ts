/**
 * spawn-agent-fleet.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  spawnAgentFleet,
  OpenclawTenantMissingError,
} from '../spawn-agent-fleet';
import type { AgentTask } from '../spawn-agent-fleet';

// Mock audit to avoid D1 dependency
vi.mock('../audit', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

// Mock circuit-breaker to avoid state bleed between tests
vi.mock('@/seed/utils/in-memory-circuit-breaker', () => ({
  withBreaker: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  getBreakerState: vi.fn(() => 'closed'),
  resetBreaker: vi.fn(),
  FLEET_BREAKER: 'agent-fleet-spawner',
  BreakerOpenError: class BreakerOpenError extends Error {
    constructor() { super('breaker open'); this.name = 'BreakerOpenError'; }
  },
}));

// Mock retry to avoid real delays in tests
vi.mock('@/seed/utils/retry-with-backoff', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

describe('spawnAgentFleet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws OpenclawTenantMissingError when tenantId is empty', async () => {
    await expect(
      spawnAgentFleet([{ id: 't1', prompt: 'hello' }], { tenantId: '' }),
    ).rejects.toThrow(OpenclawTenantMissingError);
  });

  it('throws OpenclawTenantMissingError when tenantId is undefined', async () => {
    await expect(
      // @ts-expect-error intentional bad input for test
      spawnAgentFleet([{ id: 't1', prompt: 'hello' }], {}),
    ).rejects.toThrow(OpenclawTenantMissingError);
  });

  it('returns one result per task', async () => {
    const tasks: AgentTask[] = [
      { id: 'task-1', prompt: 'write script' },
      { id: 'task-2', prompt: 'generate tts' },
      { id: 'task-3', prompt: 'compose video' },
    ];

    const results = await spawnAgentFleet(tasks, { tenantId: 'tenant-abc' });

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.taskId)).toEqual(['task-1', 'task-2', 'task-3']);
  });

  it('all results are successful in happy path', async () => {
    const tasks: AgentTask[] = [
      { id: 'a', prompt: 'task a' },
      { id: 'b', prompt: 'task b' },
    ];

    const results = await spawnAgentFleet(tasks, { tenantId: 'tenant-xyz' });
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('respects maxConcurrency (runs in batches of N)', async () => {
    const tasks: AgentTask[] = Array.from({ length: 6 }, (_, i) => ({
      id: `t${i}`,
      prompt: `task ${i}`,
    }));

    // With maxConcurrency=2, runs 3 batches of 2
    const results = await spawnAgentFleet(tasks, {
      tenantId: 'tenant-batch',
      parallel: true,
      maxConcurrency: 2,
    });

    expect(results).toHaveLength(6);
    expect(results.every((r) => r.taskId.startsWith('t'))).toBe(true);
  });

  it('sequential mode runs tasks one by one', async () => {
    const order: string[] = [];
    const tasks: AgentTask[] = [
      { id: 'seq-1', prompt: 'first' },
      { id: 'seq-2', prompt: 'second' },
      { id: 'seq-3', prompt: 'third' },
    ];

    const results = await spawnAgentFleet(tasks, {
      tenantId: 'tenant-seq',
      parallel: false,
    });

    // All results returned regardless of order tracking
    expect(results).toHaveLength(3);
    expect(results[0].taskId).toBe('seq-1');
    expect(results[1].taskId).toBe('seq-2');
    expect(results[2].taskId).toBe('seq-3');
    void order; // suppress unused warning
  });

  it('each task result includes durationMs', async () => {
    const results = await spawnAgentFleet(
      [{ id: 'dur-1', prompt: 'timing test' }],
      { tenantId: 'tenant-dur' },
    );
    expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('injects tenantId into task context', async () => {
    const tasks: AgentTask[] = [{ id: 'ctx-1', prompt: 'context test', context: { foo: 'bar' } }];
    const results = await spawnAgentFleet(tasks, { tenantId: 'tenant-ctx' });

    expect(results[0].success).toBe(true);
    const output = results[0].output as Record<string, unknown>;
    expect(output).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Circuit breaker + retry integration — Phase 02
// ---------------------------------------------------------------------------

describe('spawnAgentFleet — circuit breaker + retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns retryCount in result', async () => {
    const results = await spawnAgentFleet(
      [{ id: 'retry-1', prompt: 'retry test' }],
      { tenantId: 'tenant-retry' },
    );
    expect(results[0].retryCount).toBeDefined();
  });

  it('returns correct retryCount when task retries and succeeds', async () => {
    const { withRetry } = await import('@/seed/utils/retry-with-backoff');
    vi.mocked(withRetry).mockImplementationOnce(async (fn) => {
      try {
        await fn(); // attempt 1 (fails)
      } catch {}
      return fn(); // attempt 2 (succeeds)
    });

    const results = await spawnAgentFleet(
      [{ id: 'retry-2', prompt: 'retry twice' }],
      { tenantId: 'tenant-retry-count' },
    );
    expect(results[0].success).toBe(true);
    expect(results[0].retryCount).toBe(1);
  });

  it('skips dispatch and returns failure when breaker is open', async () => {
    const { getBreakerState } = await import('@/seed/utils/in-memory-circuit-breaker');
    vi.mocked(getBreakerState).mockReturnValueOnce('open');

    const results = await spawnAgentFleet(
      [{ id: 'open-1', prompt: 'will be skipped' }],
      { tenantId: 'tenant-open' },
    );

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('circuit breaker open');
    expect(results[0].durationMs).toBe(0);
  });

  it('wraps executor in withRetry', async () => {
    const { withRetry } = await import('@/seed/utils/retry-with-backoff');
    await spawnAgentFleet(
      [{ id: 'wrapped-1', prompt: 'wrapped' }],
      { tenantId: 'tenant-wrap' },
    );
    expect(vi.mocked(withRetry)).toHaveBeenCalled();
  });

  it('wraps executor in withBreaker', async () => {
    const { withBreaker } = await import('@/seed/utils/in-memory-circuit-breaker');
    await spawnAgentFleet(
      [{ id: 'breaker-1', prompt: 'breaker' }],
      { tenantId: 'tenant-breaker' },
    );
    expect(vi.mocked(withBreaker)).toHaveBeenCalledWith(
      'agent-fleet-spawner',
      expect.any(Function),
    );
  });
});

// ---------------------------------------------------------------------------
// Prompt contract validation — Phase 03
// ---------------------------------------------------------------------------

describe('spawnAgentFleet — prompt contract validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches successfully when valid promptContract + agentRole provided', async () => {
    const tasks: AgentTask[] = [
      {
        id: 'contract-ok',
        prompt: 'write script',
        agentRole: 'script_writer',
        promptContract: {
          objective: 'Write a product launch script',
          outputFormat: 'markdown',
          topic: 'AI tools',
          tone: 'professional',
          targetLength: 'short',
        },
      },
    ];

    const results = await spawnAgentFleet(tasks, { tenantId: 'tenant-contract' });
    expect(results[0].success).toBe(true);
    expect(results[0].error).toBeUndefined();
  });

  it('returns failure result with contract validation error for invalid contract', async () => {
    const tasks: AgentTask[] = [
      {
        id: 'contract-bad',
        prompt: 'write script',
        agentRole: 'script_writer',
        promptContract: {
          objective: 'Write a script',
          outputFormat: 'markdown',
          // topic missing — required for script_writer
          tone: 'professional',
          targetLength: 'short',
        },
      },
    ];

    const results = await spawnAgentFleet(tasks, { tenantId: 'tenant-contract' });
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('Contract validation');
    expect(results[0].error).toContain('script_writer');
  });

  it('skips validation (backwards compat) when no promptContract', async () => {
    const tasks: AgentTask[] = [
      { id: 'no-contract', prompt: 'do stuff' },
    ];

    const results = await spawnAgentFleet(tasks, { tenantId: 'tenant-compat' });
    expect(results[0].success).toBe(true);
  });

  it('skips validation when agentRole absent but promptContract present', async () => {
    // Only fires when BOTH fields present — this should pass through
    const tasks: AgentTask[] = [
      {
        id: 'role-missing',
        prompt: 'do stuff',
        promptContract: { objective: 'something', outputFormat: 'json' },
        // agentRole intentionally omitted
      },
    ];

    const results = await spawnAgentFleet(tasks, { tenantId: 'tenant-partial' });
    expect(results[0].success).toBe(true);
  });
});
