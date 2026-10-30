/**
 * Execution Render Worker — turns a `render_queued` run into verified media.
 *
 * Flow: pre-side-effect re-verification → single provider submit (bound to the
 * run via provider_job_id) → sleep/poll loop → guarded media download →
 * tenant-scoped R2 store → SHA-256 checksum from the stored bytes →
 * `recordVerifiedArtifact` (run → `rendered`).
 *
 * Idempotency: submit binds exactly one provider job id; replays poll the
 * bound job; artifact insert is ON CONFLICT DO NOTHING; run transitions are
 * CAS. Submit-then-crash before binding can theoretically double-submit (the
 * provider API offers no idempotency key); the window is one step with no
 * other awaits, and duplicates converge on the first recorded job id.
 *
 * Layer: forest (durable job)
 * @module forest/inngest/functions/execution-render-worker
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getHeyGenKey } from '@/tree/credentials/get-provider-key';
import {
  getExecutionRun,
  recordRenderSubmission,
  recordVerifiedArtifact,
  transitionRun,
} from '@/tree/affiliate/execution';
import { verifyRenderReady, type RenderReadyErrorCode } from '@/tree/affiliate/execution/render-verify';
import {
  heyGenRenderAdapter,
  type RenderAdapter,
} from '@/land/video/render/render-adapter';
import { storeVerifiedMedia } from '@/land/video/storage/verified-media-store';

const MAX_POLLS = 40;
const POLL_SLEEP = '45s';

type LoadResult =
  | { ok: true; scriptBody: string; approvalId: string; campaignId: string; existingJobId: string | null }
  | { ok: false; code: RenderReadyErrorCode | 'BAD_EVENT' | 'RUN_NOT_FOUND' | 'DB_UNAVAILABLE'; message: string; state?: string };

async function resolveByokKey(userId: string): Promise<string | null> {
  try {
    const result = await getHeyGenKey({ userId, fallbackToPlatform: false });
    return result?.key ?? null;
  } catch {
    return null;
  }
}

async function failRun(
  db: D1Database,
  tenantId: string,
  runId: string,
  reason: string,
): Promise<void> {
  const res = await transitionRun(db, tenantId, runId, 'render_queued', 'failed', {
    failureReason: reason,
  });
  if (!res.ok) {
    logger.warn('executionRenderWorker: could not record run failure', {
      runId,
      reason,
      error: String(res.error),
    });
  }
}

async function loadAndVerify(tenantId: string, runId: string): Promise<LoadResult> {
  if (!tenantId || !runId) {
    return { ok: false, code: 'BAD_EVENT', message: 'tenantId and runId required' };
  }
  const db = await getD1();
  if (!db) return { ok: false, code: 'DB_UNAVAILABLE', message: 'Database not available' };
  const run = await getExecutionRun(db, tenantId, runId);
  if (!run) return { ok: false, code: 'RUN_NOT_FOUND', message: `Run ${runId} not found` };
  if (run.state !== 'render_queued') {
    return {
      ok: false,
      code: 'RUN_NOT_RENDER_QUEUED',
      message: `Run is ${run.state}`,
      state: run.state,
    };
  }
  const ready = await verifyRenderReady({ db, tenantId, run, resolveApiKey: resolveByokKey });
  if (!ready.ok) {
    return { ok: false, code: ready.code, message: ready.message };
  }
  // Secrets never leave the step: only non-secret context is returned.
  return {
    ok: true,
    scriptBody: ready.scriptBody,
    approvalId: ready.approvalId,
    campaignId: run.campaignId,
    existingJobId: run.providerJobId,
  };
}

async function recordPreconditionFailure(
  verified: Extract<LoadResult, { ok: false }>,
  tenantId: string,
  runId: string,
): Promise<{ status: 'BLOCKED' | 'FAILED'; reason: string }> {
  const recordable =
    verified.code !== 'BAD_EVENT' &&
    verified.code !== 'RUN_NOT_FOUND' &&
    verified.code !== 'RUN_NOT_RENDER_QUEUED' &&
    verified.code !== 'DB_UNAVAILABLE' &&
    tenantId &&
    runId;
  if (verified.code === 'KILL_SWITCH_ACTIVE' && tenantId && runId) {
    const db = await getD1();
    if (db) {
      const res = await transitionRun(db, tenantId, runId, 'render_queued', 'blocked', {
        failureReason: verified.message,
      });
      if (!res.ok) {
        logger.warn('executionRenderWorker: could not record run block', { runId });
      }
    }
    return { status: 'BLOCKED', reason: verified.code };
  }
  if (recordable) {
    const db = await getD1();
    if (db) await failRun(db, tenantId, runId, `${verified.code}: ${verified.message}`);
  }
  return { status: 'FAILED', reason: verified.code };
}

async function recordTerminalAndThrow(
  db: D1Database,
  tenantId: string,
  runId: string,
  code: string,
  message: string,
): Promise<never> {
  if (code === 'KILL_SWITCH_ACTIVE') {
    const res = await transitionRun(db, tenantId, runId, 'render_queued', 'blocked', {
      failureReason: message,
    });
    if (!res.ok) logger.warn('executionRenderWorker: could not record run block', { runId });
    throw new Error(`RENDER_BLOCKED: ${message}`);
  }
  await failRun(db, tenantId, runId, `${code}: ${message}`);
  throw new Error(`${code}: ${message}`);
}

async function submitRenderStep(
  adapter: RenderAdapter,
  tenantId: string,
  runId: string,
  existingJobId: string | null,
): Promise<{ providerJobId: string; replayed: boolean }> {
  const db = await getD1();
  if (!db) throw new Error('DB_UNAVAILABLE');
  // TOCTOU re-read: the run must still be queued, and a job bound by a
  // concurrent worker wins over a second submit.
  const run = await getExecutionRun(db, tenantId, runId);
  if (!run || run.state !== 'render_queued') {
    throw new Error(`RUN_NOT_RENDER_QUEUED: ${run?.state ?? 'missing'}`);
  }
  const boundJobId = run.providerJobId ?? existingJobId;
  if (boundJobId) {
    return { providerJobId: boundJobId, replayed: true };
  }
  const ready = await verifyRenderReady({ db, tenantId, run, resolveApiKey: resolveByokKey });
  if (!ready.ok) {
    throw await recordTerminalAndThrow(db, tenantId, runId, ready.code, ready.message);
  }
  const { providerJobId } = await adapter.submit({
    scriptBody: ready.scriptBody,
    title: run.campaignId,
    apiKey: ready.apiKey,
  });
  const recorded = await recordRenderSubmission(db, tenantId, runId, providerJobId);
  if (!recorded.ok) throw new Error(recorded.error);
  return {
    providerJobId: recorded.value.providerJobId ?? providerJobId,
    replayed: recorded.value.replayed ?? false,
  };
}

type CheckResult =
  | { done: true; converged: true }
  | { done: true; completed: true; mediaUrl: string; durationSec?: number }
  | { done: true; failed: true; errorMessage: string }
  | { done: false };

async function checkRenderStep(
  adapter: RenderAdapter,
  tenantId: string,
  runId: string,
  providerJobId: string,
): Promise<CheckResult> {
  const db = await getD1();
  if (!db) throw new Error('DB_UNAVAILABLE');
  const run = await getExecutionRun(db, tenantId, runId);
  if (!run) throw new Error('RUN_NOT_FOUND');
  // Rendered by a concurrent worker while we slept: converge, no double work.
  if (run.state === 'rendered') return { done: true, converged: true };
  if (run.state !== 'render_queued') {
    throw new Error(`RUN_NOT_RENDER_QUEUED: ${run.state}`);
  }
  const ready = await verifyRenderReady({ db, tenantId, run, resolveApiKey: resolveByokKey });
  if (!ready.ok) {
    throw await recordTerminalAndThrow(db, tenantId, runId, ready.code, ready.message);
  }
  const status = await adapter.fetchStatus(providerJobId, ready.apiKey);
  if (status.status === 'completed' && status.mediaUrl) {
    return { done: true, completed: true, mediaUrl: status.mediaUrl, durationSec: status.durationSec };
  }
  if (status.status === 'failed') {
    return { done: true, failed: true, errorMessage: status.errorMessage ?? 'provider reported failure' };
  }
  return { done: false };
}

async function verifyAndStoreStep(
  adapter: RenderAdapter,
  tenantId: string,
  runId: string,
  mediaUrl: string,
  durationSec: number | undefined,
): Promise<{ runId: string; state: string; artifactId: string | null; byteSize: number; checksumSha256: string }> {
  const db = await getD1();
  if (!db) throw new Error('DB_UNAVAILABLE');
  const bytes = await adapter.downloadBytes(mediaUrl);
  const saved = await storeVerifiedMedia(tenantId, runId, bytes);
  const recorded = await recordVerifiedArtifact(db, tenantId, runId, {
    id: `art_${runId}`,
    storageKey: saved.storageKey,
    mediaType: 'video/mp4',
    byteSize: saved.byteSize,
    checksumSha256: saved.checksumSha256,
    isFixture: false,
    verifiedAtMs: Date.now(),
    durationSec,
  });
  if (!recorded.ok) throw new Error(recorded.error);
  return {
    runId,
    state: recorded.value.state,
    artifactId: recorded.value.artifactId,
    byteSize: saved.byteSize,
    checksumSha256: saved.checksumSha256,
  };
}

interface RenderStep {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  sleep: (name: string, duration: string) => Promise<void>;
}

type PollOutcome =
  | { kind: 'converged' }
  | { kind: 'completed'; mediaUrl: string; durationSec?: number }
  | { kind: 'failed'; errorMessage: string }
  | { kind: 'timeout' };

async function pollForMedia(
  step: RenderStep,
  adapter: RenderAdapter,
  tenantId: string,
  runId: string,
  providerJobId: string,
): Promise<PollOutcome> {
  for (let poll = 1; poll <= MAX_POLLS; poll += 1) {
    await step.sleep(`await-render-${poll}`, POLL_SLEEP);
    const checked = await step.run(`check-render-${poll}`, async () =>
      checkRenderStep(adapter, tenantId, runId, providerJobId),
    );
    if (checked.done && 'converged' in checked) return { kind: 'converged' };
    if (checked.done && 'completed' in checked) {
      return { kind: 'completed', mediaUrl: checked.mediaUrl, durationSec: checked.durationSec };
    }
    if (checked.done && 'failed' in checked) {
      return { kind: 'failed', errorMessage: checked.errorMessage };
    }
  }
  return { kind: 'timeout' };
}

export function createExecutionRenderWorker(adapter: RenderAdapter = heyGenRenderAdapter) {
  return inngest.createFunction(
    { id: 'execution-render-worker', name: 'Execution Render Worker', retries: 3 },
    { event: 'execution.render.requested' },
    async ({ event, step }) => {
      const { tenantId, runId } = event.data as { tenantId: string; runId: string };

      const verified = await step.run('load-and-verify', async () =>
        loadAndVerify(tenantId, runId),
      );
      if (!verified.ok) {
        // A missing database is transient: throw so Inngest retries with
        // backoff instead of dropping the event.
        if (verified.code === 'DB_UNAVAILABLE') throw new Error('DB_UNAVAILABLE');
        // Permanent pre-conditions: record the truthful state, do not throw
        // (a retry cannot fix a missing approval/credential/script).
        return recordPreconditionFailure(verified, tenantId, runId);
      }

      const submitted = await step.run('submit-render', async () =>
        submitRenderStep(adapter, tenantId, runId, verified.existingJobId),
      );

      // Adapt the real Inngest step tools to the minimal RenderStep seam.
      // The cast is sound: every step result here is JSON-safe, so the
      // Jsonify round-trip preserves the declared shape.
      const renderStep: RenderStep = {
        run: <T>(name: string, fn: () => Promise<T>): Promise<T> =>
          step.run(name, fn) as Promise<T>,
        sleep: (name: string, duration: string) => step.sleep(name, duration),
      };
      const polled = await pollForMedia(renderStep, adapter, tenantId, runId, submitted.providerJobId);
      if (polled.kind === 'converged') {
        return { status: 'RENDERED' as const, converged: true };
      }
      if (polled.kind === 'failed') {
        const db = await getD1();
        if (db) await failRun(db, tenantId, runId, `PROVIDER_FAILED: ${polled.errorMessage}`);
        return { status: 'FAILED' as const, reason: 'PROVIDER_FAILED' };
      }
      if (polled.kind === 'timeout') {
        const db = await getD1();
        if (db) await failRun(db, tenantId, runId, 'RENDER_TIMEOUT: provider did not complete in time');
        return { status: 'FAILED' as const, reason: 'RENDER_TIMEOUT' };
      }

      const stored = await step.run('verify-and-store', async () =>
        verifyAndStoreStep(adapter, tenantId, runId, polled.mediaUrl, polled.durationSec),
      );
      logger.info('executionRenderWorker: run rendered with verified media', {
        runId,
        byteSize: stored.byteSize,
      });
      return { status: 'RENDERED' as const, ...stored };
    },
  );
}

export const executionRenderWorker = createExecutionRenderWorker();
