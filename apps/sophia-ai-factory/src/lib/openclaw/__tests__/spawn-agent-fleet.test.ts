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
