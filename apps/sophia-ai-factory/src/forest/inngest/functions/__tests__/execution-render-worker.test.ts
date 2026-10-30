/**
 * Execution Render Worker tests — durable render with verified media.
 *
 * Uses the labeled fixture adapter (never production code paths for bytes),
 * an in-memory R2 bucket, and a SQLite-backed D1 fake. Proves: happy-path
 * render_queued → rendered with checksum-from-bytes, kill-after-approve
 * blocking, missing-credential failure, provider-failure recording, submit
 * idempotency on replay, and convergence when already rendered.
 *
 * @module forest/inngest/functions/__tests__/execution-render-worker.test
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
      id: 'execution-render-worker',
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
  mockGetHeyGenKey: vi.fn(
    async (): Promise<{ key: string; source: string } | null> => ({
      key: 'key_byok_1',
      source: 'user',
    }),
  ),
  mockPut: vi.fn(async (_key: string, _body: unknown, _opts?: unknown): Promise<void> => {}),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
  createServerClient: vi.fn(),
}));

vi.mock('@/tree/affiliate/kill-switch/kill-switch-store', () => ({
  getAffiliateKillSwitchState: mocks.mockGetKillState,
}));

vi.mock('@/tree/credentials/get-provider-key', () => ({
  getHeyGenKey: mocks.mockGetHeyGenKey,
}));

vi.mock('@/land/video/storage/r2-binding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/land/video/storage/r2-binding')>();
  return {
    ...actual,
    getVideoBucket: vi.fn(async () => ({
      bucket: { put: mocks.mockPut },
      publicBaseUrl: null,
    })),
  };
});

import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { createCampaignApproval } from '@/tree/affiliate/approval/campaign-approval-repo';
import { beginExecutionRun, getExecutionRun } from '@/tree/affiliate/execution';
import type { CampaignApprovalPayload } from '@/seed/security/approval-payload-hash';
import { createExecutionRenderWorker } from '../execution-render-worker';
import {
  createFixtureRenderAdapter,
  type FixtureScenario,
} from '@/land/video/render/fixture-render-adapter';
import { sha256Hex } from '@/land/video/render/render-adapter';

const SCHEMA = [
  `CREATE TABLE agent_campaign_approvals (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
    niche TEXT NOT NULL, jurisdiction TEXT NOT NULL, approval_payload_hash TEXT NOT NULL,
    estimated_render_cost_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending_ceo',
    approved_by TEXT, approved_at INTEGER, invalidated_reason TEXT,
    payload_json TEXT, dispatch_json TEXT, expires_at INTEGER,
    revoked_by TEXT, revoked_at INTEGER, executed_at INTEGER, rejection_reason TEXT,
    created_at INTEGER NOT NULL
  );`,
  `CREATE TABLE affiliate_execution_runs (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
    offer_id TEXT, approval_id TEXT, idempotency_key TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'approval_pending', locale TEXT NOT NULL DEFAULT 'en',
    market TEXT, artifact_id TEXT, channel_id TEXT,
    reserved_cost_cents INTEGER NOT NULL DEFAULT 0, actual_cost_cents INTEGER,
    failure_reason TEXT, provider_job_id TEXT, render_attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );`,
  `CREATE UNIQUE INDEX idx_runs_idem ON affiliate_execution_runs(tenant_id, idempotency_key);`,
  `CREATE TABLE affiliate_media_artifacts (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, run_id TEXT NOT NULL,
    storage_key TEXT NOT NULL, media_type TEXT NOT NULL, byte_size INTEGER NOT NULL,
    duration_sec INTEGER, checksum_sha256 TEXT NOT NULL, is_fixture INTEGER NOT NULL DEFAULT 0,
    verified_at INTEGER NOT NULL, created_at INTEGER NOT NULL
  );`,
  `CREATE UNIQUE INDEX idx_artifacts_run_storage ON affiliate_media_artifacts(tenant_id, run_id, storage_key);`,
];

const basePayload: CampaignApprovalPayload = {
  scriptBody: 'Honest review of Acme SaaS for agencies',
  affiliateTargetUrl: 'https://sophia.ai/r/acme',
  jurisdiction: 'US',
  disclosureText: '#ad — affiliate link',
  maxRenderCostCents: 50,
};

const mockStep = {
  run: (async <T>(_name: string, fn: () => Promise<T>): Promise<T> => fn()) as StepRunFn,
  sleep: async () => {},
};

function getHandler(scenario: FixtureScenario = 'success'): Handler {
  const fn = createExecutionRenderWorker(createFixtureRenderAdapter(scenario)) as unknown as {
    _handler: Handler;
  };
  return fn._handler;
}

describe('executionRenderWorker', () => {
  let db: D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetKillState.mockResolvedValue({ active: false, known: true });
    mocks.mockGetHeyGenKey.mockResolvedValue({ key: 'key_byok_1', source: 'user' });
    db = createFakeD1(SCHEMA) as unknown as D1Database;
    mocks.mockGetD1.mockResolvedValue(db);
  });

  async function seedQueuedRun(): Promise<{ approvalId: string; runId: string }> {
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
        productName: 'Acme',
        productUrl: 'https://acme.example/signup',
      },
      status: 'approved',
      approvedBy: 'ceo_1',
    });
    if (!created.ok) throw new Error(created.error.message);
    const begun = await beginExecutionRun(db, {
      tenantId: 'ws_1',
      campaignId: 'camp_1',
      offerId: 'offer_1',
      approvalId: created.value.id,
      idempotencyKey: 'ws_1:camp_1',
      reservedCostCents: 50,
    });
    if (!begun.ok) throw new Error(begun.error);
    await db
      .prepare(`UPDATE affiliate_execution_runs SET state = 'render_queued' WHERE id = ?`)
      .bind(begun.value.id)
      .run();
    return { approvalId: created.value.id, runId: begun.value.id };
  }

  it('renders a queued run: submit once, poll, store bytes, record checksum-from-bytes', async () => {
    const { runId } = await seedQueuedRun();
    const result = await getHandler()({
      event: { data: { tenantId: 'ws_1', runId } },
      step: mockStep,
    });

    expect(result.status).toBe('RENDERED');
    const run = await getExecutionRun(db, 'ws_1', runId);
    expect(run?.state).toBe('rendered');
    expect(run?.providerJobId).toBe('fixture_job_success');
    expect(run?.artifactId).toBe(`art_${runId}`);
    // Cost: reserved from the approval; actual unknown from the provider.
    expect(run?.reservedCostCents).toBe(50);
    expect(run?.actualCostCents).toBeNull();

    // Exactly one R2 put under the tenant-scoped key.
    expect(mocks.mockPut).toHaveBeenCalledTimes(1);
    const putCall = mocks.mockPut.mock.calls[0];
    if (!putCall) throw new Error('expected exactly one R2 put');
    const [key, body] = putCall as unknown as [string, Uint8Array];
    expect(key).toBe(`tenants/ws_1/videos/${runId}/final.mp4`);

    // The recorded checksum is recomputed from the stored bytes — proof, not assertion.
    const artifact = await db
      .prepare(`SELECT * FROM affiliate_media_artifacts WHERE run_id = ?`)
      .bind(runId)
      .first<Record<string, unknown>>();
    expect(artifact).not.toBeNull();
    expect(artifact?.byte_size).toBe(body.byteLength);
    expect(artifact?.checksum_sha256).toBe(await sha256Hex(body));
    expect(artifact?.is_fixture).toBe(0);
    expect(result.checksumSha256).toBe(artifact?.checksum_sha256);
  });

  it('blocks (not fails) when the kill switch flips after queue', async () => {
    mocks.mockGetKillState.mockResolvedValue({ active: true, known: true });
    const { runId } = await seedQueuedRun();
    const result = await getHandler()({
      event: { data: { tenantId: 'ws_1', runId } },
      step: mockStep,
    });
    expect(result.status).toBe('BLOCKED');
    const run = await getExecutionRun(db, 'ws_1', runId);
    expect(run?.state).toBe('blocked');
    expect(mocks.mockPut).not.toHaveBeenCalled();
  });

  it('fails truthfully when no BYOK key is connected', async () => {
    mocks.mockGetHeyGenKey.mockResolvedValue(null);
    const { runId } = await seedQueuedRun();
    const result = await getHandler()({
      event: { data: { tenantId: 'ws_1', runId } },
      step: mockStep,
    });
    expect(result.status).toBe('FAILED');
    expect(result.reason).toBe('CREDENTIALS_MISSING');
    const run = await getExecutionRun(db, 'ws_1', runId);
    expect(run?.state).toBe('failed');
    expect(run?.failureReason).toContain('CREDENTIALS_MISSING');
  });

  it('records provider failure with the provider message', async () => {
    const { runId } = await seedQueuedRun();
    const result = await getHandler('provider-failure')({
      event: { data: { tenantId: 'ws_1', runId } },
      step: mockStep,
    });
    expect(result.status).toBe('FAILED');
    expect(result.reason).toBe('PROVIDER_FAILED');
    const run = await getExecutionRun(db, 'ws_1', runId);
    expect(run?.state).toBe('failed');
    expect(run?.failureReason).toContain('fixture provider failure');
    expect(mocks.mockPut).not.toHaveBeenCalled();
  });

  it('does not resubmit when the run already has a bound job (replay)', async () => {
    const { runId } = await seedQueuedRun();
    await db
      .prepare(
        `UPDATE affiliate_execution_runs SET provider_job_id = ?, render_attempts = 1 WHERE id = ?`,
      )
      .bind('fixture_job_success', runId)
      .run();
    const adapter = createFixtureRenderAdapter('success');
    const submitSpy = vi.spyOn(adapter, 'submit');
    const fn = createExecutionRenderWorker(adapter) as unknown as { _handler: Handler };
    const result = await fn._handler({
      event: { data: { tenantId: 'ws_1', runId } },
      step: mockStep,
    });
    expect(result.status).toBe('RENDERED');
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('converges without work when the run is already rendered', async () => {
    const { runId } = await seedQueuedRun();
    await db
      .prepare(`UPDATE affiliate_execution_runs SET state = 'rendered' WHERE id = ?`)
      .bind(runId)
      .run();
    const result = await getHandler()({
      event: { data: { tenantId: 'ws_1', runId } },
      step: mockStep,
    });
    expect(result.status).toBe('FAILED');
    expect(result.reason).toBe('RUN_NOT_RENDER_QUEUED');
    expect(mocks.mockPut).not.toHaveBeenCalled();
  });
});
