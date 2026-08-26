/**
 * Tests for approval-timeout-cron — the 15-minute sweep that expires stale
 * pending approvals and fails their awaiting_approval runs.
 *
 * The repo (expireStaleApprovals) is mocked at the module boundary; the cron
 * handler is extracted from the InngestFunction wrapper via the same
 * createFunction-capture pattern used by agent-rollback-cron.test.ts.
 *
 * @module forest/inngest/functions/__tests__/approval-timeout-cron
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  expireStaleApprovals: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  // Captured at module-evaluation time (createFunction runs on import), so it
  // survives vi.clearAllMocks() in beforeEach.
  registrations: [] as Array<{ config: unknown; trigger: unknown }>,
}));

vi.mock('@/tree/mission/agent-run-repo', () => ({
  expireStaleApprovals: (...args: unknown[]) => mocks.expireStaleApprovals(...args),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn(
      (config: unknown, trigger: unknown, handler: (...args: unknown[]) => unknown) => {
        mocks.registrations.push({ config, trigger });
        return { _handler: handler };
      }
    ),
  },
}));

import { approvalTimeoutCron } from '../approval-timeout-cron';

type CronResult = {
  expiredCount: number;
  expired: Array<{ id: string; agentRunId: string }>;
};
type CronHandler = () => Promise<CronResult>;

function getHandler(): CronHandler {
  return (approvalTimeoutCron as unknown as { _handler: CronHandler })._handler;
}

describe('approval-timeout-cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is registered with id approval-timeout-sweep, retries 2, and a 15-minute cron', () => {
    expect(mocks.registrations).toHaveLength(1);
    const { config, trigger } = mocks.registrations[0] as {
      config: { id: string; retries: number };
      trigger: { cron: string };
    };
    expect(config.id).toBe('approval-timeout-sweep');
    expect(config.retries).toBe(2);
    expect(trigger.cron).toBe('*/15 * * * *');
  });

  it('expires stale approvals and returns the expired set', async () => {
    mocks.expireStaleApprovals.mockResolvedValue({
      ok: true,
      value: {
        expiredCount: 2,
        expired: [
          { id: 'appr_a', agentRunId: 'run_1' },
          { id: 'appr_b', agentRunId: 'run_2' },
        ],
      },
    });

    const result = await getHandler()();

    expect(mocks.expireStaleApprovals).toHaveBeenCalledTimes(1);
    expect(result.expiredCount).toBe(2);
    expect(result.expired).toEqual([
      { id: 'appr_a', agentRunId: 'run_1' },
      { id: 'appr_b', agentRunId: 'run_2' },
    ]);
  });

  it('returns zero when nothing is overdue', async () => {
    mocks.expireStaleApprovals.mockResolvedValue({
      ok: true,
      value: { expiredCount: 0, expired: [] },
    });

    const result = await getHandler()();

    expect(result.expiredCount).toBe(0);
    expect(result.expired).toEqual([]);
  });

  it('throws when expireStaleApprovals fails so Inngest retries', async () => {
    mocks.expireStaleApprovals.mockResolvedValue({
      ok: false,
      error: { code: 'DB_UNAVAILABLE', message: 'D1 not available' },
    });

    await expect(getHandler()()).rejects.toThrow(
      'expireStaleApprovals failed: DB_UNAVAILABLE D1 not available'
    );
    expect(mocks.logger.error).toHaveBeenCalled();
  });
});
