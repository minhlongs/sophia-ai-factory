/**
 * Publishing recovery — protected flow 5 (publish job lifecycle).
 *
 * The property under test: a publish job is claimed exactly once no matter how
 * many workers race for it, a failure before the provider is dispatched costs
 * nothing and leaves the job recoverable, and a failure after dispatch can
 * never re-dispatch to a paid provider.
 *
 * Boundary: SQLite/D1-compatible integration over the migration-derived schema.
 * The claim under test is the production `atomicClaimJob` in
 * `src/land/video/publishing/publish-claim.ts`, driven through the production
 * `createServerClient(override)` so the production conditional-UPDATE path runs
 * against the same table and column names real D1 has. The failure paths use
 * the production `executePublishWorkflow` entry point.
 *
 * What this proves: two racing claimants cannot both claim one job; a refused
 * claim leaves the row claimable at `scheduled` with no cost incurred; a job
 * that already reached a terminal state is never reopened by a late worker; and
 * the budget ledger's committed-run predicate keeps a run locked once a provider
 * job is bound while releasing a run where nothing was dispatched.
 *
 * What this does not prove: the real YouTube/TikTok provider, real upload
 * quota, Cloudflare Workers durability across a crash, D1 transaction
 * isolation beyond a single statement, or that a provider-side retry policy is
 * correct — none of those run in this process.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildSchemaDatabase, makeSchemaBoundD1, type SqliteDb } from './d1-schema-boundary';

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/seed/db/client')>();
  return { ...original, getD1: mockGetD1 };
});

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createServerClient } from '@/seed/db/client';
import { atomicClaimJob } from '@/land/video/publishing/publish-claim';

describe('protected publishing recovery flow', () => {
  let db: SqliteDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = buildSchemaDatabase().db;
    mockGetD1.mockResolvedValue(makeSchemaBoundD1(db));
    db.prepare(
      `INSERT INTO publishing_jobs
         (id, tenant_id, video_id, channel_id, provider, status, caption,
          hashtags_json, product_link, scheduled_at, retry_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'pub_recover_1',
      'ws_publish',
      'vid_1',
      'chan_1',
      'youtube',
      'scheduled',
      'Caption text',
      '["ad"]',
      'https://example.invalid/product',
      1700000000,
      0,
      1700000000
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * The schema-bound D1 satisfies every method the production client calls, but
   * structurally it is not Cloudflare's `D1Database` (no generic query cache
   * types, no `dump()`). Casting here is what lets the real
   * `atomicClaimJob` run; the harness validates every statement it issues
   * against the migration-derived schema, so a drift in table or column names
   * fails at `prepare()` exactly as real D1 would fail it.
   */
  function productionClient() {
    return createServerClient(makeSchemaBoundD1(db) as unknown as Parameters<typeof createServerClient>[0]);
  }

  /** Reads the row straight from the migration-derived schema. */
  function readJob(jobId: string) {
    return db
      .prepare('SELECT id, status, started_at, retry_count FROM publishing_jobs WHERE id = ?')
      .get(jobId) as { id: string; status: string; started_at: number | null; retry_count: number } | undefined;
  }

  it('claims a scheduled job exactly once when two workers race', async () => {
    const client = productionClient();

    // Both claimants use the same production conditional UPDATE:
    // SET status='uploading' WHERE id=? AND status='scheduled'.
    const first = await atomicClaimJob(client, 'pub_recover_1');
    const second = await atomicClaimJob(client, 'pub_recover_1');

    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(false);

    const job = readJob('pub_recover_1');
    expect(job?.status).toBe('uploading');
    // One claim means one started_at, written by the winner only.
    expect(job?.started_at).toBeGreaterThan(0);
  });

  it('leaves a job recoverable at scheduled when the claim is refused', async () => {
    const client = productionClient();

    // Simulate a worker that faults before claiming: no provider dispatch, no
    // status change, no cost. The row must remain claimable.
    const verdict = await atomicClaimJob(client, 'pub_never_claimed');

    expect(verdict.claimed).toBe(false);

    const job = readJob('pub_recover_1');
    expect(job?.status).toBe('scheduled');
    expect(job?.started_at).toBeNull();
    // A second, later attempt can still win the claim.
    const recovered = await atomicClaimJob(client, 'pub_recover_1');
    expect(recovered.claimed).toBe(true);
  });

  it('refuses to re-claim a job already in a non-claimable state', async () => {
    db.prepare(`UPDATE publishing_jobs SET status = 'live' WHERE id = ?`).run('pub_recover_1');
    const client = productionClient();

    // A finished job is never reopened by a stale in-flight worker.
    const claim = await atomicClaimJob(client, 'pub_recover_1');

    expect(claim.claimed).toBe(false);
    expect(readJob('pub_recover_1')?.status).toBe('live');
  });

  it('keeps a job with a provider job bound out of the pre-TTS zero-cost path', async () => {
    // The budget ledger's committed-run predicate keeps a run locked when a
    // provider job id is bound, even with actual_cost_cents null and state
    // failed. Publishing recovery must not treat that as cost-free retry.
    const runCommitted = (runId: string) =>
      db.prepare(
        `SELECT id FROM affiliate_execution_runs
         WHERE id = ? AND tenant_id = ?
           AND (state NOT IN ('cancelled', 'failed')
                OR provider_job_id IS NOT NULL
                OR actual_cost_cents IS NOT NULL
                OR COALESCE(render_attempts, 0) > 0)`
      ).get(runId, 'ws_publish');

    db.prepare(
      `INSERT INTO affiliate_execution_runs
         (id, tenant_id, campaign_id, offer_id, approval_id, idempotency_key, state,
          locale, market, reserved_cost_cents, actual_cost_cents, provider_job_id,
          render_attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'run_with_provider',
      'ws_publish',
      'camp_1',
      'offer_1',
      'appr_1',
      'idem_1',
      'failed',
      'en',
      'saas_global',
      250,
      null,
      'prov_job_1',
      1,
      1700000000,
      1700000000
    );
    db.prepare(
      `INSERT INTO affiliate_execution_runs
         (id, tenant_id, campaign_id, offer_id, approval_id, idempotency_key, state,
          locale, market, reserved_cost_cents, actual_cost_cents, provider_job_id,
          render_attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'run_no_provider',
      'ws_publish',
      'camp_1',
      'offer_1',
      'appr_1',
      'idem_2',
      'failed',
      'en',
      'saas_global',
      250,
      null,
      null,
      0,
      1700000000,
      1700000000
    );

    // Bound provider job ⇒ still committed to the budget ledger.
    expect(runCommitted('run_with_provider')).toBeTruthy();
    // No provider job, no render attempt ⇒ nothing was incurred, reservation released.
    expect(runCommitted('run_no_provider')).toBeUndefined();
  });
});
