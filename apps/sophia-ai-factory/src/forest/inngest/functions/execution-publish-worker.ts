/**
 * Execution Publish Worker — turns a `rendered` OPC run into an `unlisted`
 * YouTube publication and advances the run `rendered -> publish_queued -> published`.
 *
 * Re-verifies campaign approval (blocking `revoked`, expired, hash mismatch,
 * or active/unknown Kill Switch) via `verifyPublishReady` + `evaluatePublishGate`
 * immediately before touching `publishing_jobs` or YouTube APIs.
 *
 * Layer: forest (durable job)
 * @module forest/inngest/functions/execution-publish-worker
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  getExecutionRun,
  transitionRun,
  verifyPublishReady,
  type PublishReadyContext,
} from '@/tree/affiliate/execution';
import {
  executePublishWorkflow,
  type ClaimResult,
  type ExecutePublishWorkflowArgs,
  type Step,
} from '@/land/video/publishing/execute';
import { refreshChannelToken } from '@/forest/publishing/oauth-token-refresher';
import type { PublishApprovalStep } from '@/tree/publishing/approval';
import { producePublishProvenance } from '@/tree/youtube-strategy/provenance-producer';

export type PublishExecutorFn = (args: ExecutePublishWorkflowArgs) => Promise<ClaimResult>;

async function ensureClaimedUnlistedPublishingJob(
  db: D1Database,
  tenantId: string,
  runId: string,
  ctx: PublishReadyContext,
): Promise<{ jobId: string; claimed: boolean }> {
  const jobId = `pub_${runId}`;
  const nowSec = Math.floor(Date.now() / 1000);
  const res = await db
    .prepare(
      `INSERT INTO publishing_jobs
         (id, tenant_id, video_id, channel_id, provider, status, title, caption,
          hashtags_json, product_link, privacy_status, scheduled_at, retry_count, created_at)
       VALUES (?, ?, ?, ?, 'youtube', 'uploading', ?, ?, '["ad","affiliate"]', ?, 'unlisted', ?, 4, ?)
       ON CONFLICT(id) DO UPDATE SET status = 'uploading', retry_count = 4
       WHERE publishing_jobs.status NOT IN ('live', 'uploading', 'processing')`,
    )
    .bind(jobId, tenantId, ctx.artifactId, ctx.channelId, ctx.title, ctx.caption, ctx.productLink, nowSec, nowSec)
    .run();
  return { jobId, claimed: (res.meta?.changes ?? 0) > 0 };
}

export function createExecutionPublishWorker(runPublish: PublishExecutorFn = executePublishWorkflow) {
  return inngest.createFunction(
    { id: 'execution-publish-worker', name: 'Execution Publish Worker', retries: 2 },
    { event: 'execution.publish.requested' },
    async ({ event, step }) => {
      const { tenantId, runId } = event.data as { tenantId: string; runId: string };
      if (!tenantId || !runId) {
        return { status: 'FAILED' as const, reason: 'BAD_EVENT' };
      }

      const gate = await step.run('verify-publish-gate', async () => {
        const db = await getD1();
        if (!db) throw new Error('DB_UNAVAILABLE');
        const run = await getExecutionRun(db, tenantId, runId);
        if (!run) return { kind: 'missing' as const };
        if (run.state === 'published') return { kind: 'converged' as const };
        const verified = await verifyPublishReady({ db, tenantId, run });
        if (!verified.ok) {
          if (run.state === 'rendered' || run.state === 'publish_queued') {
            await db
              .prepare(`UPDATE publishing_jobs SET status = 'failed' WHERE id = ? AND tenant_id = ?`)
              .bind(`pub_${runId}`, tenantId)
              .run();
            await transitionRun(db, tenantId, runId, run.state, 'blocked', {
              failureReason: `${verified.reason}: ${verified.message}`,
            });
          }
          return { kind: 'blocked' as const, reason: verified.reason };
        }
        if (run.state === 'rendered') {
          const queued = await transitionRun(db, tenantId, runId, 'rendered', 'publish_queued', {
            channelId: verified.channelId,
          });
          if (!queued.ok) {
            return { kind: 'blocked' as const, reason: String(queued.error) };
          }
        }
        const { jobId, claimed } = await ensureClaimedUnlistedPublishingJob(db, tenantId, runId, verified);
        if (!claimed) {
          return { kind: 'blocked' as const, reason: 'ALREADY_IN_FLIGHT' };
        }
        return {
          kind: 'ready' as const,
          jobId,
          userId: verified.userId,
          channelId: verified.channelId,
          title: verified.title,
          caption: verified.caption,
        };
      });

      if (gate.kind === 'missing') return { status: 'FAILED' as const, reason: 'RUN_NOT_FOUND' };
      if (gate.kind === 'converged') return { status: 'PUBLISHED' as const, converged: true };
      if (gate.kind === 'blocked') return { status: 'BLOCKED' as const, reason: gate.reason };

      const provenance = producePublishProvenance({
        title: gate.title,
        caption: gate.caption,
      });

      const publishStep: Step = {
        run: <T>(id: string, fn: () => Promise<T>): Promise<T> => step.run(id, fn) as Promise<T>,
        sleep: (id: string, duration: string) => step.sleep(id, duration),
      };
      const outcome = await runPublish({
        jobId: gate.jobId,
        tenantId,
        userId: gate.userId,
        alreadyClaimed: true,
        provenance,
        step: publishStep,
        // The job this worker creates is 'unlisted', which the approval gate
        // treats as a public intent, so the gate needs to emit and wait.
        // Handing it a step that only runs and sleeps makes every publish from
        // this worker throw instead of publishing, so the runtime's own event
        // tools are passed through exactly as publish-execute does.
        eventTools: step as unknown as PublishApprovalStep,
        scheduleRetry: async () => {},
        refreshToken: refreshChannelToken,
      });

      return step.run('finalize-execution-publish', async () => {
        const db = await getD1();
        if (!db) throw new Error('DB_UNAVAILABLE');
        if (outcome.status === 'live' && outcome.externalPostId) {
          await transitionRun(db, tenantId, runId, 'publish_queued', 'published', {
            channelId: gate.channelId,
          });
          logger.info('executionPublishWorker: run published as unlisted', {
            runId,
            jobId: gate.jobId,
            externalPostId: outcome.externalPostId,
          });
          return { status: 'PUBLISHED' as const, jobId: gate.jobId, externalPostId: outcome.externalPostId };
        }
        const reason = ('error' in outcome && outcome.error) || `PUBLISH_${outcome.status.toUpperCase()}`;
        await db
          .prepare(`UPDATE publishing_jobs SET status = 'failed' WHERE id = ? AND tenant_id = ?`)
          .bind(gate.jobId, tenantId)
          .run();
        await transitionRun(db, tenantId, runId, 'publish_queued', 'failed', {
          failureReason: reason,
        });
        return { status: 'FAILED' as const, reason, jobId: gate.jobId };
      });
    },
  );
}

export const executionPublishWorker = createExecutionPublishWorker();
