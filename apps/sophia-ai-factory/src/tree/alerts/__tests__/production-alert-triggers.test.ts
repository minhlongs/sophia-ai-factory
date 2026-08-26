/**
 * Unit tests for production alert triggers.
 *
 * Deterministic: createRealtimeAlert is mocked. Verifies alert type,
 * severity mapping, and metadata payload for each of the three triggers.
 *
 * @module tree/alerts/__tests__/production-alert-triggers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockCreateRealtimeAlert = vi.fn();

vi.mock('../realtime-alert-mutations', () => ({
  createRealtimeAlert: (...args: unknown[]) => mockCreateRealtimeAlert(...args),
}));

import {
  triggerRetriesExhaustedAlert,
  triggerApprovalExpiredAlert,
  triggerBudgetCapAlert,
} from '../production-alert-triggers';
import type { CreateAlertParams } from '../realtime-alert-types';

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateRealtimeAlert.mockResolvedValue('alert-1');
});

function lastParams(): CreateAlertParams {
  return mockCreateRealtimeAlert.mock.calls[0][0] as CreateAlertParams;
}

describe('triggerRetriesExhaustedAlert', () => {
  it('creates a high-severity production.run_cancelled alert with run metadata', async () => {
    const alertId = await triggerRetriesExhaustedAlert({
      userId: 'user-1',
      licenseNonce: 'nonce-1',
      graphRunId: 'run-abcdef1234567890',
      missionId: 'mission-1',
      retryCount: 3,
      maxRetries: 3,
    });

    expect(alertId).toBe('alert-1');
    const params = lastParams();
    expect(params.type).toBe('production.run_cancelled');
    expect(params.severity).toBe('high');
    expect(params.metadata).toMatchObject({
      graphRunId: 'run-abcdef1234567890',
      missionId: 'mission-1',
      retryCount: 3,
      maxRetries: 3,
      reason: 'RETRIES_EXHAUSTED',
    });
  });
});

describe('triggerApprovalExpiredAlert', () => {
  it('creates a medium-severity alert when overdue by less than 4 hours', async () => {
    await triggerApprovalExpiredAlert({
      userId: 'user-1',
      licenseNonce: 'nonce-1',
      approvalId: 'appr-abcdef1234567890',
      agentRunId: 'run-1',
      actionType: 'publish_content',
      timeoutMs: 3_600_000,
      elapsedMs: 3_600_000 + 2 * 3_600_000, // 2h overdue
    });

    const params = lastParams();
    expect(params.type).toBe('production.approval_expired');
    expect(params.severity).toBe('medium');
    expect(params.metadata).toMatchObject({ hoursOverdue: 2 });
  });

  it('escalates to critical severity when overdue by more than 4 hours', async () => {
    await triggerApprovalExpiredAlert({
      userId: 'user-1',
      licenseNonce: 'nonce-1',
      approvalId: 'appr-abcdef1234567890',
      agentRunId: 'run-1',
      actionType: 'publish_content',
      timeoutMs: 3_600_000,
      elapsedMs: 3_600_000 + 5 * 3_600_000, // 5h overdue
    });

    const params = lastParams();
    expect(params.severity).toBe('critical');
    expect(params.metadata).toMatchObject({ hoursOverdue: 5 });
  });

  it('clamps negative overdue to zero when elapsed is under the timeout', async () => {
    await triggerApprovalExpiredAlert({
      userId: 'user-1',
      licenseNonce: 'nonce-1',
      approvalId: 'appr-abcdef1234567890',
      agentRunId: 'run-1',
      actionType: 'publish_content',
      timeoutMs: 3_600_000,
      elapsedMs: 1_800_000, // not yet overdue
    });

    const params = lastParams();
    expect(params.severity).toBe('medium');
    expect(params.metadata).toMatchObject({ hoursOverdue: 0 });
  });
});

describe('triggerBudgetCapAlert', () => {
  it('creates a high-severity alert when the cap is reached', async () => {
    await triggerBudgetCapAlert({
      userId: 'user-1',
      licenseNonce: 'nonce-1',
      graphRunId: 'run-abcdef1234567890',
      missionId: 'mission-1',
      totalCostCents: 10_000,
      budgetCapCents: 10_000,
    });

    const params = lastParams();
    expect(params.type).toBe('production.budget_cap');
    expect(params.severity).toBe('high');
    expect(params.title).toBe('Budget Cap Reached');
    expect(params.metadata).toMatchObject({ percentUsed: 100 });
  });

  it('creates a medium-severity warning below the cap', async () => {
    await triggerBudgetCapAlert({
      userId: 'user-1',
      licenseNonce: 'nonce-1',
      graphRunId: 'run-abcdef1234567890',
      missionId: 'mission-1',
      totalCostCents: 8_000,
      budgetCapCents: 10_000,
    });

    const params = lastParams();
    expect(params.severity).toBe('medium');
    expect(params.title).toBe('Budget Cap Warning');
    expect(params.metadata).toMatchObject({ percentUsed: 80 });
  });

  it('treats a zero cap as fully consumed', async () => {
    await triggerBudgetCapAlert({
      userId: 'user-1',
      licenseNonce: 'nonce-1',
      graphRunId: 'run-abcdef1234567890',
      missionId: 'mission-1',
      totalCostCents: 500,
      budgetCapCents: 0,
    });

    const params = lastParams();
    expect(params.severity).toBe('high');
    expect(params.metadata).toMatchObject({ percentUsed: 100 });
  });
});
