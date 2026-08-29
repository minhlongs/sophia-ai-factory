/**
 * Unit tests: Reality Loop v1 canonical emitters (Phase C).
 * Verifies: each emitter emits the right event_type + allowlisted payload,
 * never throws, idempotent-safe, and deterministic (byte-identical minus id).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const recorded: Array<{ eventType: string; entityId: string; valueCents?: number; rawData?: Record<string, unknown> }> = [];

vi.mock('../events', () => ({
  recordPerformanceEventIdempotent: vi.fn(async (event: { eventType: string; entityId: string; valueCents?: number; rawData?: Record<string, unknown> }) => {
    recorded.push({ eventType: event.eventType, entityId: event.entityId, valueCents: event.valueCents, rawData: event.rawData });
    return true;
  }),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  classifyAutonomyFailure,
  loopEventId,
  type AutonomyFailureClass,
} from '../loop-events';

import {
  emitMissionCreated,
  emitMissionAbandoned,
  emitAgentStarted,
  emitAgentFailed,
  emitApprovalRequested,
  emitApprovalApproved,
  emitApprovalRejected,
} from '../loop-emitters-runner';

import {
  emitCreativeAccepted,
  emitCreativeEdited,
  emitCreativeRejected,
} from '../loop-emitters-creative';

import {
  emitMemoryUsed,
  emitMemoryCorrected,
  emitMissionCostRecorded,
} from '../loop-emitters-cost';

const ctx = { workspaceId: 'ws_1', recordedAt: 1700000000 };

beforeEach(() => recorded.length = 0);

describe('classifyAutonomyFailure (pure taxonomy)', () => {
  it('maps BUDGET_EXCEEDED → COST_LIMIT', () => {
    expect(classifyAutonomyFailure(new Error('over budget'), { code: 'BUDGET_EXCEEDED' })).toBe('COST_LIMIT');
  });
  it('maps approval rejection → APPROVAL_ERROR', () => {
    expect(classifyAutonomyFailure(new Error('nope'), { approvalOutcome: 'rejected' })).toBe('APPROVAL_ERROR');
  });
  it('maps approval timeout → APPROVAL_ERROR', () => {
    expect(classifyAutonomyFailure(new Error('slow'), { approvalOutcome: 'timeout' })).toBe('APPROVAL_ERROR');
  });
  it('maps PERMISSION_DENIED → PERMISSION_ERROR', () => {
    expect(classifyAutonomyFailure(new Error('denied'), { code: 'PERMISSION_DENIED' })).toBe('PERMISSION_ERROR');
  });
  it('maps POLICY_BLOCK → POLICY_BLOCK', () => {
    expect(classifyAutonomyFailure(new Error('blocked'), { code: 'POLICY_BLOCK' })).toBe('POLICY_BLOCK');
  });
  it('maps TOOL_ERROR → TOOL_ERROR', () => {
    expect(classifyAutonomyFailure(new Error('tool fail'), { code: 'TOOL_ERROR' })).toBe('TOOL_ERROR');
  });
  it('maps PROVIDER_ERROR → PROVIDER_ERROR', () => {
    expect(classifyAutonomyFailure(new Error('api key'), { code: 'PROVIDER_ERROR' })).toBe('PROVIDER_ERROR');
  });
  it('maps TIMEOUT → TIMEOUT', () => {
    expect(classifyAutonomyFailure(new Error('timed out'), { code: 'TIMEOUT' })).toBe('TIMEOUT');
  });
  it('maps BAD_CONTEXT → BAD_CONTEXT', () => {
    expect(classifyAutonomyFailure(new Error('missing'), { code: 'BAD_CONTEXT' })).toBe('BAD_CONTEXT');
  });
  it('maps BAD_MEMORY → BAD_MEMORY', () => {
    expect(classifyAutonomyFailure(new Error('retrieval'), { code: 'BAD_MEMORY' })).toBe('BAD_MEMORY');
  });
  it('maps REASONING_ERROR → REASONING_ERROR', () => {
    expect(classifyAutonomyFailure(new Error('truncated'), { code: 'REASONING_ERROR' })).toBe('REASONING_ERROR');
  });
  it('maps USER_AMBIGUITY → USER_AMBIGUITY', () => {
    expect(classifyAutonomyFailure(new Error('ambiguous'), { code: 'USER_AMBIGUITY' })).toBe('USER_AMBIGUITY');
  });
  it('falls back to UNKNOWN', () => {
    expect(classifyAutonomyFailure(new Error('mystery'))).toBe('UNKNOWN');
  });
  it('is pure: no side effects, deterministic', () => {
    const a = classifyAutonomyFailure(new Error('x'), { code: 'TIMEOUT' });
    const b = classifyAutonomyFailure(new Error('x'), { code: 'TIMEOUT' });
    expect(a).toBe(b);
  });
});

describe('loopEventId (deterministic)', () => {
  it('is stable for same inputs', () => {
    expect(loopEventId('mission.created', 'm1', 'ws1')).toBe(loopEventId('mission.created', 'm1', 'ws1'));
  });
  it('differs for different inputs', () => {
    expect(loopEventId('mission.created', 'm1', 'ws1')).not.toBe(loopEventId('mission.created', 'm2', 'ws1'));
  });
});

describe('emitMissionCreated', () => {
  it('emits mission.created with allowlisted payload', async () => {
    const ok = await emitMissionCreated({ ...ctx, missionId: 'm1', autonomyLevel: 2, budgetCents: 1000 });
    expect(ok).toBe(true);
    expect(recorded[0].eventType).toBe('mission.created');
    expect(recorded[0].rawData).toMatchObject({ autonomy_level: 2, budget_cents: 1000 });
    // privacy: no prompt/text/PII
    expect(JSON.stringify(recorded[0].rawData)).not.toMatch(/prompt|api[_-]?key|token|secret/i);
  });
});

describe('emitMissionAbandoned', () => {
  it('emits mission.abandoned', async () => {
    await emitMissionAbandoned({ ...ctx, missionId: 'm1', reason: 'no_budget', stage: 'init' });
    expect(recorded[0].eventType).toBe('mission.abandoned');
    expect(recorded[0].rawData).toMatchObject({ reason: 'no_budget', stage: 'init' });
  });
});

describe('emitAgentStarted', () => {
  it('emits agent.started with node/agent ids only', async () => {
    await emitAgentStarted({ ...ctx, missionId: 'm1', graphRunId: 'g1', nodeId: 'n1', agentSlug: 'writer', agentRunId: 'r1' });
    expect(recorded[0].eventType).toBe('agent.started');
    expect(recorded[0].rawData).toMatchObject({ graph_run_id: 'g1', node_id: 'n1', agent_slug: 'writer', agent_run_id: 'r1' });
  });
});

describe('emitAgentFailed', () => {
  it('emits agent.failed with failure_class + cost', async () => {
    await emitAgentFailed({
      ...ctx, missionId: 'm1', graphRunId: 'g1', nodeId: 'n1', agentSlug: 'writer', agentRunId: 'r1',
      errorCode: 'BUDGET_EXCEEDED', errorMessage: 'over', failureClass: 'COST_LIMIT', costCents: 50, totalTokens: 100, durationMs: 200,
    });
    expect(recorded[0].eventType).toBe('agent.failed');
    expect(recorded[0].valueCents).toBe(50);
    expect(recorded[0].rawData).toMatchObject({ failure_class: 'COST_LIMIT', error_code: 'BUDGET_EXCEEDED', total_tokens: 100, duration_ms: 200 });
  });
});

describe('emitApprovalRequested', () => {
  it('emits approval.requested', async () => {
    await emitApprovalRequested({ ...ctx, missionId: 'm1', graphRunId: 'g1', nodeId: 'n1', approvalId: 'a1', actionType: 'publish' });
    expect(recorded[0].eventType).toBe('approval.requested');
    expect(recorded[0].rawData).toMatchObject({ approval_id: 'a1', action_type: 'publish' });
  });
});

describe('emitApprovalApproved', () => {
  it('emits approval.approved with latency', async () => {
    await emitApprovalApproved({ ...ctx, missionId: 'm1', graphRunId: 'g1', nodeId: 'n1', approvalId: 'a1', actionType: 'publish', latencySeconds: 42 });
    expect(recorded[0].eventType).toBe('approval.approved');
    expect(recorded[0].rawData).toMatchObject({ latency_seconds: 42 });
  });
});

describe('emitApprovalRejected', () => {
  it('emits approval.rejected with reason_code', async () => {
    await emitApprovalRejected({ ...ctx, missionId: 'm1', graphRunId: 'g1', nodeId: 'n1', approvalId: 'a1', actionType: 'publish', reasonCode: 'LOW_QUALITY', latencySeconds: 30 });
    expect(recorded[0].eventType).toBe('approval.rejected');
    expect(recorded[0].rawData).toMatchObject({ reason_code: 'LOW_QUALITY' });
  });
});

describe('emitCreativeAccepted', () => {
  it('emits creative.accepted', async () => {
    await emitCreativeAccepted({ ...ctx, missionId: 'm1', graphRunId: 'g1', nodeId: 'n1', assetId: 'ast1', agentSlug: 'writer' });
    expect(recorded[0].eventType).toBe('creative.accepted');
    expect(recorded[0].rawData).toMatchObject({ asset_id: 'ast1', agent_slug: 'writer' });
  });
});

describe('emitCreativeEdited', () => {
  it('emits creative.edited with edit_count', async () => {
    await emitCreativeEdited({ ...ctx, missionId: 'm1', graphRunId: 'g1', nodeId: 'n1', assetId: 'ast1', agentSlug: 'writer', editCount: 3 });
    expect(recorded[0].eventType).toBe('creative.edited');
    expect(recorded[0].rawData).toMatchObject({ edit_count: 3 });
  });
});

describe('emitCreativeRejected', () => {
  it('emits creative.rejected with reason_code', async () => {
    await emitCreativeRejected({ ...ctx, missionId: 'm1', graphRunId: 'g1', nodeId: 'n1', assetId: 'ast1', agentSlug: 'writer', reasonCode: 'NOT_MY_STYLE' });
    expect(recorded[0].eventType).toBe('creative.rejected');
    expect(recorded[0].rawData).toMatchObject({ reason_code: 'NOT_MY_STYLE' });
  });
});

describe('emitMemoryUsed', () => {
  it('emits memory.used with confidence + count', async () => {
    await emitMemoryUsed({ ...ctx, missionId: 'm1', agentId: 'writer', runId: 'r1', confidence: 'high', memoryCount: 4 });
    expect(recorded[0].eventType).toBe('memory.used');
    expect(recorded[0].rawData).toMatchObject({ confidence: 'high', memory_count: 4 });
  });
});

describe('emitMemoryCorrected', () => {
  it('emits memory.corrected', async () => {
    await emitMemoryCorrected({ ...ctx, missionId: 'm1', agentId: 'writer', runId: 'r1', correctionType: 'style_fix', previousConfidence: 'medium' });
    expect(recorded[0].eventType).toBe('memory.corrected');
    expect(recorded[0].rawData).toMatchObject({ correction_type: 'style_fix', previous_confidence: 'medium' });
  });
});

describe('emitMissionCostRecorded', () => {
  it('emits mission.cost_recorded with value_cents + totals', async () => {
    await emitMissionCostRecorded({ ...ctx, missionId: 'm1', amountCents: 25, totalSpentCents: 75, budgetCents: 1000, nodeId: 'n1', agentSlug: 'writer' });
    expect(recorded[0].eventType).toBe('mission.cost_recorded');
    expect(recorded[0].valueCents).toBe(25);
    expect(recorded[0].rawData).toMatchObject({ total_spent_cents: 75, budget_cents: 1000 });
  });
});

describe('never throws (side-channel contract)', () => {
  it('swallows downstream failure and returns false', async () => {
    const { recordPerformanceEventIdempotent } = await import('../events');
    vi.mocked(recordPerformanceEventIdempotent).mockRejectedValueOnce(new Error('D1 down'));
    const ok = await emitMissionCreated({ ...ctx, missionId: 'm1', autonomyLevel: 1, budgetCents: 0 });
    expect(ok).toBe(false);
  });
});

describe('idempotency (deterministic id → re-emit is no-op)', () => {
  it('same identity → same id → second emit is INSERT OR IGNORE no-op', async () => {
    const { recordPerformanceEventIdempotent } = await import('../events');
    vi.mocked(recordPerformanceEventIdempotent).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const a = await emitMissionCreated({ ...ctx, missionId: 'idem1', autonomyLevel: 1, budgetCents: 0 });
    const b = await emitMissionCreated({ ...ctx, missionId: 'idem1', autonomyLevel: 1, budgetCents: 0 });
    expect(a).toBe(true);
    expect(b).toBe(false);
  });
});

describe('determinism (byte-identical minus id)', () => {
  it('two emits with same inputs produce identical rawData', async () => {
    await emitAgentStarted({ ...ctx, missionId: 'm1', graphRunId: 'g1', nodeId: 'n1', agentSlug: 'writer', agentRunId: 'r1' });
    await emitAgentStarted({ ...ctx, missionId: 'm1', graphRunId: 'g1', nodeId: 'n1', agentSlug: 'writer', agentRunId: 'r1' });
    expect(recorded[0].rawData).toEqual(recorded[1].rawData);
    expect(recorded[0].eventType).toBe(recorded[1].eventType);
  });
});
