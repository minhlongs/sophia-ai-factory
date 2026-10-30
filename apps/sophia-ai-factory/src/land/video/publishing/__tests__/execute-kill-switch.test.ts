/**
 * Kill-switch gate tests for the scheduled publish executor.
 *
 * `executePublishWorkflow` re-evaluates the workspace/platform halt
 * immediately before claim/upload. An unreadable halt state must abort the
 * publish (loud `failed` row) — never release it.
 *
 * @module land/video/publishing/__tests__/execute-kill-switch.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executePublishWorkflow } from '../execute';
import type { ExecutePublishWorkflowArgs } from '../publish-types';
import { createServerClient } from '@/seed/db/client';
import { findJobById, checkAndMarkMaxRetries, atomicClaimJob } from '../publish-claim';
import { getAffiliateKillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('../publish-claim', () => ({
  findJobById: vi.fn(),
  checkAndMarkMaxRetries: vi.fn(),
  atomicClaimJob: vi.fn(),
}));

vi.mock('@/tree/affiliate/kill-switch/kill-switch-store', () => ({
  getAffiliateKillSwitchState: vi.fn(),
}));

function workflowArgs(): ExecutePublishWorkflowArgs {
  return {
    jobId: 'job_1',
    tenantId: 'ws_1',
    userId: 'user_1',
    step: { sleep: vi.fn(async () => undefined), run: vi.fn(async (_n: string, fn: () => Promise<unknown>) => fn()) },
    scheduleRetry: vi.fn(async () => undefined),
  };
}

describe('executePublishWorkflow kill-switch gate', () => {
  const update = vi.fn();
  const eq = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    update.mockReturnValue({ eq });
    eq.mockResolvedValue({});
    vi.mocked(createServerClient).mockReturnValue({ from: vi.fn(() => ({ update })) } as never);
    vi.mocked(findJobById).mockResolvedValue({ id: 'job_1', tenant_id: 'ws_1', status: 'scheduled' } as never);
    vi.mocked(checkAndMarkMaxRetries).mockResolvedValue(false);
    vi.mocked(getAffiliateKillSwitchState).mockResolvedValue({ active: false, known: true });
  });

  it('aborts with KILL_SWITCH_UNKNOWN when the halt state is unreadable', async () => {
    vi.mocked(getAffiliateKillSwitchState).mockResolvedValue({
      active: false,
      known: false,
      reason: 'KV read failed; D1 read failed',
    });

    const res = await executePublishWorkflow(workflowArgs());

    expect(res).toMatchObject({ status: 'failed', error: 'KILL_SWITCH_UNKNOWN' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error_message: expect.stringContaining('unreadable'),
      }),
    );
    expect(atomicClaimJob).not.toHaveBeenCalled();
  });

  it('aborts with KILL_SWITCH_ACTIVE when the halt is engaged', async () => {
    vi.mocked(getAffiliateKillSwitchState).mockResolvedValue({ active: true, known: true });

    const res = await executePublishWorkflow(workflowArgs());

    expect(res).toMatchObject({ status: 'failed', error: 'KILL_SWITCH_ACTIVE' });
    expect(atomicClaimJob).not.toHaveBeenCalled();
  });

  it('proceeds to the claim step when the halt is off and known', async () => {
    vi.mocked(atomicClaimJob).mockResolvedValue({ claimed: false } as never);

    const res = await executePublishWorkflow(workflowArgs());

    expect(atomicClaimJob).toHaveBeenCalled();
    expect(res).toMatchObject({ skipped: true });
  });
});
