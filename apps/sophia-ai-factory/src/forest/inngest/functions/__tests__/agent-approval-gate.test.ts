/**
 * Tests for agent-approval-gate — requestApprovalAndAwait orchestration.
 *
 * Drives the gate with a deterministic FAKE step (no Inngest runtime, no
 * network). The repo (createApproval / markRunAwaitingApproval / failAwaitingRun)
 * is mocked at the module boundary so these tests isolate the gate's control
 * flow: approve wakes the wait, rejected/timeout fail the run, and the
 * filter-loop ignores resolved events for other approvals.
 *
 * @module forest/inngest/functions/__tests__/agent-approval-gate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createApproval: vi.fn(),
  markRunAwaitingApproval: vi.fn(),
  failAwaitingRun: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/tree/mission/agent-run-repo', () => ({
  createApproval: (...args: unknown[]) => mocks.createApproval(...args),
  markRunAwaitingApproval: (...args: unknown[]) => mocks.markRunAwaitingApproval(...args),
  failAwaitingRun: (...args: unknown[]) => mocks.failAwaitingRun(...args),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

import type { AgentApprovalResolvedData } from '@/seed/inngest/agent-event-types';
import {
  requestApprovalAndAwait,
  type ApprovalGateStep,
  type ApprovalGateInput,
} from '../agent-approval-gate';

// ---------------------------------------------------------------------------
// Deterministic fake step
// ---------------------------------------------------------------------------

interface FakeStepOptions {
  /** Queue of resolved events waitForEvent returns, in order; then null. */
  resolvedEvents?: AgentApprovalResolvedData[];
}

interface FakeStepHandle {
  step: ApprovalGateStep;
  runIds: string[];
  sentEvents: Array<{ id: string; name: string; data: Record<string, unknown> }>;
  waitCalls: Array<{ id: string; event: string; timeout: number }>;
}

function makeFakeStep(options: FakeStepOptions = {}): FakeStepHandle {
  const queue = [...(options.resolvedEvents ?? [])];
  const runIds: string[] = [];
  const sentEvents: Array<{ id: string; name: string; data: Record<string, unknown> }> = [];
  const waitCalls: Array<{ id: string; event: string; timeout: number }> = [];

  const step: ApprovalGateStep = {
    run: async (id, fn) => {
      runIds.push(id);
      return fn();
    },
    sendEvent: async (id, payload) => {
      sentEvents.push({ id, name: payload.name, data: payload.data });
      return { ids: ['evt_1'] };
    },
    waitForEvent: async (id, opts) => {
      waitCalls.push({ id, event: opts.event, timeout: opts.timeout });
      return queue.shift() ?? null;
    },
  };

  return { step, runIds, sentEvents, waitCalls };
}

const FIXED_NOW = 1_700_000_000_000;
const nowMs = () => FIXED_NOW;

function baseInput(overrides: Partial<ApprovalGateInput> = {}): ApprovalGateInput {
  return {
    runId: 'run_1',
    missionId: 'mission_1',
    actionId: 'publish_video',
    actionType: 'publish',
    actionSummary: 'Publish video to YouTube',
    estimatedCostCents: 120,
    timeoutMs: 60_000,
    approvalId: 'appr_fixed_123',
    attempt: 0,
    ...overrides,
  };
}

function resolvedEvent(
  overrides: Partial<AgentApprovalResolvedData['data']> = {}
): AgentApprovalResolvedData {
  return {
    data: {
      approvalId: 'appr_fixed_123',
      runId: 'run_1',
      status: 'approved',
      reviewerId: 'user_9',
      ...overrides,
    },
  };
}

describe('agent-approval-gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createApproval.mockResolvedValue({ ok: true, value: { id: 'appr_fixed_123' } });
    mocks.markRunAwaitingApproval.mockResolvedValue({ ok: true, value: { flipped: true } });
    mocks.failAwaitingRun.mockResolvedValue({ ok: true, value: { failed: true } });
  });

  it('approved: emits requested, wakes on matching resolved, returns approvedActionIds', async () => {
    const fake = makeFakeStep({ resolvedEvents: [resolvedEvent()] });

    const decision = await requestApprovalAndAwait(baseInput(), { step: fake.step, nowMs });

    expect(decision).toEqual({
      outcome: 'approved',
      approvedActionIds: ['publish_video'],
      reviewerId: 'user_9',
      comment: undefined,
    });

    // First sender of agent.approval.requested with the exact seed payload shape.
    expect(fake.sentEvents).toHaveLength(1);
    expect(fake.sentEvents[0].name).toBe('agent.approval.requested');
    expect(fake.sentEvents[0].data).toEqual({
      runId: 'run_1',
      approvalId: 'appr_fixed_123',
      actionType: 'publish',
      actionSummary: 'Publish video to YouTube',
      missionId: 'mission_1',
    });

    // Approval row created with the timeout derived from timeoutMs.
    expect(mocks.createApproval).toHaveBeenCalledTimes(1);
    const created = mocks.createApproval.mock.calls[0][0] as { timeoutAt: number; id: string };
    expect(created.id).toBe('appr_fixed_123');
    expect(created.timeoutAt).toBe(Math.floor((FIXED_NOW + 60_000) / 1000));

    // Run flipped to awaiting_approval; never failed on the approved path.
    expect(mocks.markRunAwaitingApproval).toHaveBeenCalledWith('run_1');
    expect(mocks.failAwaitingRun).not.toHaveBeenCalled();
  });

  it('rejected: marks the run failed with APPROVAL_REJECTED', async () => {
    const fake = makeFakeStep({
      resolvedEvents: [resolvedEvent({ status: 'rejected', comment: 'not safe' })],
    });

    const decision = await requestApprovalAndAwait(baseInput(), { step: fake.step, nowMs });

    expect(decision).toEqual({
      outcome: 'rejected',
      reviewerId: 'user_9',
      comment: 'not safe',
    });
    expect(mocks.failAwaitingRun).toHaveBeenCalledTimes(1);
    const [runId, errorJson, message] = mocks.failAwaitingRun.mock.calls[0] as [
      string,
      Record<string, unknown>,
      string,
    ];
    expect(runId).toBe('run_1');
    expect(errorJson.code).toBe('APPROVAL_REJECTED');
    expect(errorJson.approvalId).toBe('appr_fixed_123');
    expect(message).toBe('not safe');
  });

  it('timeout: no resolved event → marks run failed with APPROVAL_TIMEOUT', async () => {
    const fake = makeFakeStep({ resolvedEvents: [] });

    const decision = await requestApprovalAndAwait(baseInput(), { step: fake.step, nowMs });

    expect(decision).toEqual({ outcome: 'timeout' });
    expect(mocks.failAwaitingRun).toHaveBeenCalledTimes(1);
    const [runId, errorJson, message] = mocks.failAwaitingRun.mock.calls[0] as [
      string,
      Record<string, unknown>,
      string,
    ];
    expect(runId).toBe('run_1');
    expect(errorJson.code).toBe('APPROVAL_TIMEOUT');
    expect(message).toBe('Approval timed out before review');
  });

  it('filter-loop: ignores resolved events for other approvals, wakes on match', async () => {
    const fake = makeFakeStep({
      resolvedEvents: [
        resolvedEvent({ approvalId: 'appr_OTHER_aaa' }),
        resolvedEvent({ approvalId: 'appr_OTHER_bbb' }),
        resolvedEvent({ approvalId: 'appr_fixed_123' }),
      ],
    });

    const decision = await requestApprovalAndAwait(baseInput(), { step: fake.step, nowMs });

    expect(decision.outcome).toBe('approved');
    // Three waits: two ignored, one matching.
    expect(fake.waitCalls).toHaveLength(3);
    expect(fake.waitCalls.every((w) => w.event === 'agent.approval.resolved')).toBe(true);
  });

  it('skips the gate when the run is not in running state (guarded flip lost)', async () => {
    mocks.markRunAwaitingApproval.mockResolvedValue({ ok: true, value: { flipped: false } });
    const fake = makeFakeStep({ resolvedEvents: [resolvedEvent()] });

    const decision = await requestApprovalAndAwait(baseInput(), { step: fake.step, nowMs });

    expect(decision).toEqual({ outcome: 'skipped', reason: 'run_not_running' });
    // No requested event, no wait, no fail when the run already moved on.
    expect(fake.sentEvents).toHaveLength(0);
    expect(fake.waitCalls).toHaveLength(0);
    expect(mocks.failAwaitingRun).not.toHaveBeenCalled();
  });

  it('throws when createApproval fails so Inngest retries', async () => {
    mocks.createApproval.mockResolvedValue({
      ok: false,
      error: { code: 'DB_ERROR', message: 'boom' },
    });
    const fake = makeFakeStep();

    await expect(
      requestApprovalAndAwait(baseInput(), { step: fake.step, nowMs })
    ).rejects.toThrow('createApproval failed: DB_ERROR boom');
  });

  it('uses a unique wait step id per attempt to avoid replaying a memoized wait', async () => {
    const fakeA0 = makeFakeStep({ resolvedEvents: [resolvedEvent()] });
    await requestApprovalAndAwait(baseInput({ attempt: 0 }), { step: fakeA0.step, nowMs });
    const fakeA1 = makeFakeStep({ resolvedEvents: [resolvedEvent()] });
    await requestApprovalAndAwait(baseInput({ attempt: 1 }), { step: fakeA1.step, nowMs });

    expect(fakeA0.waitCalls[0].id).toBe('await-approval-appr_fixed_123-a0-p0');
    expect(fakeA1.waitCalls[0].id).toBe('await-approval-appr_fixed_123-a1-p0');
  });
});
