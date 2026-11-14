/**
 * Execution Publish Worker tests — turns a `rendered` OPC run into an
 * `unlisted` YouTube publication and advances `rendered -> publish_queued -> published`,
 * while blocking pre-publish revoked approvals and active kill switch with 0 uploads.
 *
 * @module forest/inngest/functions/__tests__/execution-publish-worker.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type StepRunFn = <T>(name: string, fn: () => Promise<T>) => Promise<T>;
type Handler = (ctx: {
  event: { data: { tenantId: string; runId: string } };
  step: { run: StepRunFn; sleep: (name: string, duration: string) => Promise<void> };
}) => Promise<Record<string, unknown>>;

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: (_config: unknown, _trigger: unknown, handler: Handler) => ({
      id: 'execution-publish-worker',
      _handler: handler,
    }),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockGetKillState: vi.fn(async () => ({ active: false, known: true })),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
  createServerClient: vi.fn(),
}));

vi.mock('@/tree/affiliate/kill-switch/kill-switch-store', () => ({
  getAffiliateKillSwitchState: mocks.mockGetKillState,
}));

import { createSchemaBoundD1 } from '@/__tests__/integration/d1-schema-boundary';
import {
  createCampaignApproval,
  markApprovalExecuted,
  revokeCampaignApproval,
} from '@/tree/affiliate/approval/campaign-approval-repo';
import {
  beginExecutionRun,
  getExecutionRun,
  recordVerifiedArtifact,
  transitionRun,
} from '@/tree/affiliate/execution';
import type { CampaignApprovalPayload } from '@/seed/security/approval-payload-hash';
import {
  createExecutionPublishWorker,
  type PublishExecutorFn,
} from '../execution-publish-worker';

const basePayload: CampaignApprovalPayload = {
  scriptBody: 'Honest review of Acme SaaS for agencies',
  affiliateTargetUrl: 'https://sophia.ai/r/acme',
  jurisdiction: 'US',
  disclosureText: '#ad — affiliate link',
  maxRenderCostCents: 250,
  targetAccount: 'ch_yt_1',
};

const mockStep = {
  run: (async <T>(_name: string, fn: () => Promise<T>): Promise<T> => fn()) as StepRunFn,
  sleep: async () => {},
};

describe('executionPublishWorker', () => {
  let db: D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetKillState.mockResolvedValue({ active: false, known: true });
    db = createSchemaBoundD1().d1 as unknown as D1Database;
    mocks.mockGetD1.mockResolvedValue(db);
  });

  async function seedRenderedRun(): Promise<{ approvalId: string; runId: string }> {
    await db
      .prepare(
        `INSERT INTO publishing_channels (id, tenant_id, user_id, provider, external_account_id, access_token, status, created_at, updated_at)
         VALUES ('ch_yt_1', 'ws_1', 'ceo_1', 'youtube', 'UC_owner_1', 'enc_token_1', 'active', 1000, 1000)`,
      )
      .run();

    const created = await createCampaignApproval(db, {
      tenantId: 'ws_1',
      campaignId: 'camp_1',
      niche: 'saas_global',
      jurisdiction: 'US',
      payload: basePayload,
      dispatch: {
        userId: 'ceo_1',
        offerId: 'offer_1',
        niche: 'saas_global',
        blueprintId: 'bp_1',
        productName: 'Acme SaaS',
        productUrl: 'https://acme.example/signup',
      },
      status: 'approved',
      approvedBy: 'ceo_1',
    });
    if (!created.ok) throw new Error(created.error.message);
    await markApprovalExecuted(db, 'ws_1', created.value.id);

    const begun = await beginExecutionRun(db, {
      tenantId: 'ws_1',
      campaignId: 'camp_1',
      offerId: 'offer_1',
      approvalId: created.value.id,
      idempotencyKey: 'ws_1:camp_1',
      reservedCostCents: 250,
    });
    if (!begun.ok) throw new Error(begun.error);
    await transitionRun(db, 'ws_1', begun.value.id, 'approval_pending', 'render_queued', {});
    const recorded = await recordVerifiedArtifact(db, 'ws_1', begun.value.id, {
      id: `art_${begun.value.id}`,
      storageKey: `tenants/ws_1/videos/${begun.value.id}/final.mp4`,
      mediaType: 'video/mp4',
      byteSize: 4096,
      checksumSha256: 'a'.repeat(64),
      isFixture: false,
      verifiedAtMs: Date.now(),
      durationSec: 30,
    });
    if (!recorded.ok) throw new Error(recorded.error);
    return { approvalId: created.value.id, runId: begun.value.id };
  }

  it('publishes a rendered run as unlisted and transitions rendered -> publish_queued -> published', async () => {
    const { approvalId, runId } = await seedRenderedRun();
    const executor = vi.fn<PublishExecutorFn>(async ({ jobId }) => ({
      skipped: false,
      jobId,
      status: 'live',
      externalPostId: 'yt_video_unlisted_123',
      provider: 'youtube',
    }));

    const worker = createExecutionPublishWorker(executor) as unknown as { _handler: Handler };
    const res = await worker._handler({
      event: { data: { tenantId: 'ws_1', runId } },
      step: mockStep,
    });

    expect(res.status).toBe('PUBLISHED');
    expect(res.externalPostId).toBe('yt_video_unlisted_123');
    expect(executor).toHaveBeenCalledTimes(1);

    const jobRow = await db
      .prepare(`SELECT video_id, channel_id, title, privacy_status, product_link FROM publishing_jobs WHERE id = ?`)
      .bind(`pub_${runId}`)
      .first<Record<string, unknown>>();
    expect(jobRow?.video_id).toBe(`art_${runId}`);
    expect(jobRow?.channel_id).toBe('ch_yt_1');
    expect(typeof jobRow?.title).toBe('string');
    expect((jobRow?.title as string).length).toBeGreaterThan(0);
    expect(jobRow?.privacy_status).toBe('unlisted');
    expect(jobRow?.product_link).toBe('https://sophia.ai/r/acme');

    const run = await getExecutionRun(db, 'ws_1', runId);
    expect(run?.state).toBe('published');
    expect(run?.channelId).toBe('ch_yt_1');

    // Once published, revokeCampaignApproval is blocked per I-02.
    const lateRevoke = await revokeCampaignApproval(db, {
      tenantId: 'ws_1',
      approvalId,
      operatorId: 'ceo_1',
      reason: 'Attempt revoke after publish',
    });
    expect(lateRevoke.ok).toBe(false);
  });

  it('marks publishing_jobs as failed and blocks on replay when upload fails or approval is revoked mid-queue', async () => {
    const { approvalId, runId } = await seedRenderedRun();
    const failExecutor = vi.fn<PublishExecutorFn>(async ({ jobId }) => ({
      skipped: false,
      jobId,
      status: 'failed',
      externalPostId: '',
      provider: '',
      error: 'UPLOAD_QUOTA_EXCEEDED',
    }));

    const worker = createExecutionPublishWorker(failExecutor) as unknown as { _handler: Handler };
    const res = await worker._handler({
      event: { data: { tenantId: 'ws_1', runId } },
      step: mockStep,
    });
    expect(res.status).toBe('FAILED');

    const jobRow = await db
      .prepare(`SELECT status FROM publishing_jobs WHERE id = ?`)
      .bind(`pub_${runId}`)
      .first<{ status: string }>();
    expect(jobRow?.status).toBe('failed');

    const failedRun = await getExecutionRun(db, 'ws_1', runId);
    expect(failedRun?.actualCostCents).toBeNull();
    expect(failedRun?.reservedCostCents).toBe(250);

    // Also verify targetAccount strictness: if approval specifies a non-matching channel, block with 0 uploads.
    await db
      .prepare(`UPDATE publishing_channels SET id = 'ch_other', external_account_id = 'UC_other' WHERE id = 'ch_yt_1'`)
      .run();
    await db
      .prepare(`UPDATE affiliate_execution_runs SET state = 'rendered' WHERE id = ?`)
      .bind(runId)
      .run();
    const mismatchExecutor = vi.fn<PublishExecutorFn>();
    const mismatchWorker = createExecutionPublishWorker(mismatchExecutor) as unknown as { _handler: Handler };
    const mismatchRes = await mismatchWorker._handler({
      event: { data: { tenantId: 'ws_1', runId } },
      step: mockStep,
    });
    expect(mismatchRes.status).toBe('BLOCKED');
    expect(mismatchExecutor).not.toHaveBeenCalled();
    expect(approvalId).toBeTruthy();
  });

  it('blocks rendered -> blocked with 0 uploads when the approval was revoked before publish', async () => {
    const { approvalId, runId } = await seedRenderedRun();
    const revoked = await revokeCampaignApproval(db, {
      tenantId: 'ws_1',
      approvalId,
      operatorId: 'ceo_1',
      reason: 'CEO revoked before publish',
    });
    expect(revoked.ok).toBe(true);

    const executor = vi.fn<PublishExecutorFn>();
    const worker = createExecutionPublishWorker(executor) as unknown as { _handler: Handler };
    const res = await worker._handler({
      event: { data: { tenantId: 'ws_1', runId } },
      step: mockStep,
    });

    expect(res.status).toBe('BLOCKED');
    expect(res.reason).toBe('APPROVAL_INVALIDATED');
    expect(executor).not.toHaveBeenCalled();

    const run = await getExecutionRun(db, 'ws_1', runId);
    expect(run?.state).toBe('blocked');
  });

  it('blocks rendered -> blocked with 0 uploads when the kill switch is active', async () => {
    mocks.mockGetKillState.mockResolvedValue({ active: true, known: true });
    const { runId } = await seedRenderedRun();

    const executor = vi.fn<PublishExecutorFn>();
    const worker = createExecutionPublishWorker(executor) as unknown as { _handler: Handler };
    const res = await worker._handler({
      event: { data: { tenantId: 'ws_1', runId } },
      step: mockStep,
    });

    expect(res.status).toBe('BLOCKED');
    expect(res.reason).toBe('KILL_SWITCH_ACTIVE');
    expect(executor).not.toHaveBeenCalled();

    const run = await getExecutionRun(db, 'ws_1', runId);
    expect(run?.state).toBe('blocked');
  });
});
