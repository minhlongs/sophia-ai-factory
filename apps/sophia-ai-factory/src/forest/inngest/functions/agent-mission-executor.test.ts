/**
 * Tests for forest/inngest/functions/agent-mission-executor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/tree/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_opts: unknown, trigger: unknown, _fn: unknown) => ({ trigger })),
  },
}));

import { agentMissionExecutor } from './agent-mission-executor';

describe('agentMissionExecutor', () => {
  it('is registered for agent.mission.started event', () => {
    const fn = agentMissionExecutor as unknown as { trigger: { event: string } };
    expect(fn.trigger.event).toBe('agent.mission.started');
  });
});