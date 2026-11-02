/**
 * DB-boundary tests: real SQLite (D1-compatible) migration upgrade, tenant
 * isolation, idempotency and concurrent state transitions.
 *
 * These tests do not mock the database. `createFakeD1` uses better-sqlite3 in
 * CI and Node's built-in node:sqlite where native bindings cannot be built.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import {
  beginExecutionRun,
  getExecutionRun,
  getWorkspacePilotBudgetSummary,
  recordRenderSubmission,
  recordVerifiedArtifact,
  transitionRun,
} from '../execution-repo';
import type { VerifiedArtifact } from '../execution-contract';

const MIGRATION_0206 = readFileSync(
  resolve(process.cwd(), 'migrations/0206_commission_events.sql'),
  'utf8',
);
const MIGRATION_0482 = readFileSync(
  resolve(process.cwd(), 'migrations/0482_opc_affiliate_execution_truth.sql'),
  'utf8',
);
const MIGRATION_0486 = readFileSync(
  resolve(process.cwd(), 'migrations/0486_execution_render_tracking.sql'),
  'utf8',
);

function upgradedDb() {
  // Simulate the pre-0482 database: commission_events already exists from 0206,
  // but the OPC tables do not. Apply 0482 twice to prove the upgrade is rerunnable.
  // 0486 is an additive ALTER (single-apply via the wrangler journal, matching
  // the repo's 0477 convention); it is applied once.
  const fake = createFakeD1([MIGRATION_0206]);
  fake._db.exec(MIGRATION_0482);
  fake._db.exec(MIGRATION_0482);
  fake._db.exec(MIGRATION_0486);
  return fake as unknown as D1Database;
}

const artifact: VerifiedArtifact = {
  id: 'art_fixture_1',
  storageKey: 'r2://ws-a/fixtures/run-1.mp4',
  mediaType: 'video/mp4',
  byteSize: 4096,
  checksumSha256: 'b'.repeat(64),
  isFixture: true,
  verifiedAtMs: 1_700_000_000_000,
  durationSec: 15,
};

describe('migration 0482 upgrade (D1-compatible SQLite)', () => {
  it('creates every table production code references and is rerunnable', () => {
    const fake = createFakeD1([MIGRATION_0206]);
    fake._db.exec(MIGRATION_0482);
    fake._db.exec(MIGRATION_0482);

    const names = fake._db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as unknown as Array<{ name: string }>;
    const set = new Set(names.map((n) => n.name));
    for (const table of [
      'commission_events',
      'workspace_external_commissions',
      'agent_campaign_approvals',
      'opc_postback_events',
      'affiliate_execution_runs',
      'affiliate_media_artifacts',
      'opc_feedback_events',
      'opc_bandit_arms',
    ]) {
      expect(set.has(table), table).toBe(true);
    }
  });

  it('enforces platform_fee_cents = 0 on the Domain B ledger at the DB boundary', async () => {
    const db = upgradedDb();
    const insert = db
      .prepare(
        `INSERT INTO workspace_external_commissions
          (id, tenant_id, network, niche, external_tx_id, event_type, status,
           commission_cents, platform_fee_cents, currency, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('r1', 'ws-a', 'partnerstack', 'saas_global', 'tx1', 'commission_approved', 'approved', 1000, 25, 'USD', 1000);
    await expect(insert.run()).rejects.toThrow();
  });
});

describe('execution run repository', () => {
  it('is replay-safe: duplicate begin returns the same row and does not reset state', async () => {
    const db = upgradedDb();
    const first = await beginExecutionRun(db, {
      tenantId: 'ws-a',
      campaignId: 'camp-1',
      idempotencyKey: 'event-1',
      locale: 'vi',
      market: 'VN',
      reservedCostCents: 40,
      nowMs: 1000,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.state).toBe('approval_pending');
    expect(first.value.replayed).toBe(false);

    await transitionRun(db, 'ws-a', first.value.id, 'approval_pending', 'render_queued', {}, 1001);

    const second = await beginExecutionRun(db, {
      tenantId: 'ws-a',
      campaignId: 'camp-1',
      idempotencyKey: 'event-1',
      locale: 'vi',
      nowMs: 2000,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.id).toBe(first.value.id);
    expect(second.value.replayed).toBe(true);
    expect(second.value.state).toBe('render_queued');
  });

  it('prevents concurrent double transitions (only one worker wins)', async () => {
    const db = upgradedDb();
    const begin = await beginExecutionRun(db, {
      tenantId: 'ws-a',
      campaignId: 'camp-2',
      idempotencyKey: 'event-2',
      nowMs: 1000,
    });
    if (!begin.ok) throw new Error(begin.error);
    await transitionRun(db, 'ws-a', begin.value.id, 'approval_pending', 'render_queued', {}, 1001);

    const [a, b] = await Promise.all([
      recordVerifiedArtifact(db, 'ws-a', begin.value.id, artifact, 1002),
      recordVerifiedArtifact(db, 'ws-a', begin.value.id, artifact, 1003),
    ]);
    expect(a.ok && b.ok).toBe(true);
    const current = await getExecutionRun(db, 'ws-a', begin.value.id);
    expect(current?.state).toBe('rendered');
    expect(current?.artifactId).toBe(artifact.id);

    const artifactRows = await db
      .prepare('SELECT id FROM affiliate_media_artifacts WHERE tenant_id = ? AND run_id = ?')
      .bind('ws-a', begin.value.id)
      .all<{ id: string }>();
    expect(artifactRows.results).toHaveLength(1);
  });

  it('isolates tenant A from tenant B for runs and artifacts', async () => {
    const db = upgradedDb();
    const run = await beginExecutionRun(db, {
      tenantId: 'ws-a',
      campaignId: 'camp-3',
      idempotencyKey: 'event-3',
      nowMs: 1000,
    });
    if (!run.ok) throw new Error(run.error);

    expect(await getExecutionRun(db, 'ws-b', run.value.id)).toBeNull();
    const rejected = await transitionRun(db, 'ws-b', run.value.id, 'approval_pending', 'render_queued');
    expect(rejected.ok).toBe(false);

    // Same idempotency key in another tenant is a distinct run, not a collision.
    const other = await beginExecutionRun(db, {
      tenantId: 'ws-b',
      campaignId: 'camp-other',
      idempotencyKey: 'event-3',
      nowMs: 1000,
    });
    expect(other.ok).toBe(true);
    if (other.ok) expect(other.value.id).not.toBe(run.value.id);
  });

  it('a run without verified media stays render_queued (never rendered/published)', async () => {
    const db = upgradedDb();
    const run = await beginExecutionRun(db, {
      tenantId: 'ws-a',
      campaignId: 'camp-4',
      idempotencyKey: 'event-4',
      nowMs: 1000,
    });
    if (!run.ok) throw new Error(run.error);
    await transitionRun(db, 'ws-a', run.value.id, 'approval_pending', 'render_queued', {}, 1001);

    const badTransition = await transitionRun(db, 'ws-a', run.value.id, 'render_queued', 'published');
    expect(badTransition.ok).toBe(false);
    expect((await getExecutionRun(db, 'ws-a', run.value.id))?.state).toBe('render_queued');
  });

  // P0 regression at the REAL durable boundary: recordVerifiedArtifact used to
  // trust the `VerifiedArtifact` type and could persist a zero-byte descriptor
  // and mark the run `rendered`. Prove it now refuses BEFORE any write.
  it('recordVerifiedArtifact refuses unverified media: no artifact row, no rendered state', async () => {
    const db = upgradedDb();
    const run = await beginExecutionRun(db, {
      tenantId: 'ws-a',
      campaignId: 'camp-unverified',
      idempotencyKey: 'event-unverified',
      nowMs: 1000,
    });
    if (!run.ok) throw new Error(run.error);
    await transitionRun(db, 'ws-a', run.value.id, 'approval_pending', 'render_queued', {}, 1001);

    const badCases: VerifiedArtifact[] = [
      { ...artifact, byteSize: 0 },
      { ...artifact, checksumSha256: '' },
      { ...artifact, storageKey: '' },
      { ...artifact, verifiedAtMs: 0 },
    ];
    for (const bad of badCases) {
      const res = await recordVerifiedArtifact(db, 'ws-a', run.value.id, bad, 1002);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe('MEDIA_NOT_VERIFIED');
    }

    // No artifact row was written and the durable state is still queued.
    const rows = await db
      .prepare('SELECT id FROM affiliate_media_artifacts WHERE tenant_id = ? AND run_id = ?')
      .bind('ws-a', run.value.id)
      .all<{ id: string }>();
    expect(rows.results).toHaveLength(0);
    const current = await getExecutionRun(db, 'ws-a', run.value.id);
    expect(current?.state).toBe('render_queued');
    expect(current?.artifactId).toBeNull();

    // A genuinely verified artifact still transitions to rendered (no over-block).
    const good = await recordVerifiedArtifact(db, 'ws-a', run.value.id, artifact, 1003);
    expect(good.ok).toBe(true);
    expect((await getExecutionRun(db, 'ws-a', run.value.id))?.state).toBe('rendered');
  });

  it('enforces atomic cumulative $25/vertical and $50 total pilot budget caps and locks uncertain outcomes', async () => {
    const db = upgradedDb();

    // Reserve $1,500 cents ($15.00) + $1,000 cents ($10.00) = $2,500 cents ($25.00) in saas_global
    const saas1 = await beginExecutionRun(db, {
      tenantId: 'ws-budget',
      campaignId: 'camp-saas-1',
      idempotencyKey: 'idem-saas-1',
      niche: 'saas_global',
      market: 'US',
      reservedCostCents: 1500,
    });
    expect(saas1.ok).toBe(true);
    if (saas1.ok) {
      expect(saas1.value.market).toBe('US');
      expect(saas1.value.niche).toBe('saas_global');
    }

    const saas2 = await beginExecutionRun(db, {
      tenantId: 'ws-budget',
      campaignId: 'camp-saas-2',
      idempotencyKey: 'idem-saas-2',
      niche: 'saas_global',
      market: 'GLOBAL',
      reservedCostCents: 1000,
    });
    expect(saas2.ok).toBe(true);

    // A 3rd saas_global run of $2.50 (250 cents) exceeds $25.00 vertical cap -> blocked
    const saasOverflow = await beginExecutionRun(db, {
      tenantId: 'ws-budget',
      campaignId: 'camp-saas-3',
      idempotencyKey: 'idem-saas-3',
      niche: 'saas_global',
      reservedCostCents: 250,
    });
    expect(saasOverflow.ok).toBe(false);
    if (!saasOverflow.ok) expect(saasOverflow.error).toBe('BUDGET_CAP_EXCEEDED');

    // Idempotent replay of an existing run still succeeds even when vertical cap is full
    const saas2Replay = await beginExecutionRun(db, {
      tenantId: 'ws-budget',
      campaignId: 'camp-saas-2',
      idempotencyKey: 'idem-saas-2',
      niche: 'saas_global',
      reservedCostCents: 1000,
    });
    expect(saas2Replay.ok).toBe(true);
    if (saas2Replay.ok) expect(saas2Replay.value.replayed).toBe(true);

    // Meanwhile crypto_global has its own $25.00 vertical allowance up to $50.00 total
    const crypto1 = await beginExecutionRun(db, {
      tenantId: 'ws-budget',
      campaignId: 'camp-crypto-1',
      idempotencyKey: 'idem-crypto-1',
      niche: 'crypto_global',
      market: 'US',
      reservedCostCents: 2000,
    });
    expect(crypto1.ok).toBe(true);

    // Pre-submit failure (provider_job_id IS NULL) releases reservation
    if (saas2.ok) {
      await transitionRun(db, 'ws-budget', saas2.value.id, 'approval_pending', 'render_queued');
      await transitionRun(db, 'ws-budget', saas2.value.id, 'render_queued', 'failed', {
        failureReason: 'PROVIDER_UNAVAILABLE: TTS failed before submit',
      });
    }
    const summaryAfterRelease = await getWorkspacePilotBudgetSummary(db, 'ws-budget');
    expect(summaryAfterRelease.ok).toBe(true);
    if (summaryAfterRelease.ok) {
      expect(summaryAfterRelease.value.saasCommittedCents).toBe(1500);
      expect(summaryAfterRelease.value.cryptoCommittedCents).toBe(2000);
      expect(summaryAfterRelease.value.totalCommittedCents).toBe(3500);
    }

    // Post-submit timeout (provider_job_id IS NOT NULL -> blocked UNCERTAIN_OUTCOME) keeps reservation locked
    if (crypto1.ok) {
      await transitionRun(db, 'ws-budget', crypto1.value.id, 'approval_pending', 'render_queued');
      await recordRenderSubmission(db, 'ws-budget', crypto1.value.id, 'job_heygen_99');
      await transitionRun(db, 'ws-budget', crypto1.value.id, 'render_queued', 'blocked', {
        failureReason: 'UNCERTAIN_OUTCOME: provider did not complete in time',
      });
    }
    const cryptoOverflow = await beginExecutionRun(db, {
      tenantId: 'ws-budget',
      campaignId: 'camp-crypto-2',
      idempotencyKey: 'idem-crypto-2',
      niche: 'crypto_global',
      reservedCostCents: 600,
    });
    expect(cryptoOverflow.ok).toBe(false);
    if (!cryptoOverflow.ok) expect(cryptoOverflow.error).toBe('BUDGET_CAP_EXCEEDED');
  });
});
