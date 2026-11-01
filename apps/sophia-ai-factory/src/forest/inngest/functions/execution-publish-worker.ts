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

export type PublishExecutorFn = (args: ExecutePublishWorkflowArgs) => Promise<ClaimResult>;

async function ensureUnlistedPublishingJob(
  db: D1Database,
  tenantId: string,
  runId: string,
  ctx: PublishReadyContext,
): Promise<string> {
  const jobId = `pub_${runId}`;
  const nowSec = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO publishing_jobs
         (id, tenant_id, video_id, channel_id, provider, status, title, caption,
          hashtags_json, product_link, privacy_status, scheduled_at, retry_count, created_at)
       VALUES (?, ?, ?, ?, 'youtube', 'scheduled', ?, ?, '["ad","affiliate"]', ?, 'unlisted', ?, 0, ?)
       ON CONFLICT(id) DO NOTHING`,
    )
    .bind(jobId, tenantId, ctx.artifactId, ctx.channelId, ctx.title, ctx.caption, ctx.productLink, nowSec, nowSec)
    .run();
  return jobId;
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
          if (run.state === 'rendered') {
            await transitionRun(db, tenantId, runId, 'rendered', 'blocked', {
              failureReason: `${verified.reason}: ${verified.message}`,
            });
          }
          return { kind: 'blocked' as const, reason: verified.reason };
        }
        const queued = await transitionRun(db, tenantId, runId, 'rendered', 'publish_queued', {
          channelId: verified.channelId,
        });
        if (!queued.ok) {
          return { kind: 'blocked' as const, reason: String(queued.error) };
        }
        const jobId = await ensureUnlistedPublishingJob(db, tenantId, runId, verified);
        return { kind: 'ready' as const, jobId, userId: verified.userId, channelId: verified.channelId };
      });

      if (gate.kind === 'missing') return { status: 'FAILED' as const, reason: 'RUN_NOT_FOUND' };
      if (gate.kind === 'converged') return { status: 'PUBLISHED' as const, converged: true };
      if (gate.kind === 'blocked') return { status: 'BLOCKED' as const, reason: gate.reason };

      const publishStep: Step = {
        run: <T>(id: string, fn: () => Promise<T>): Promise<T> => step.run(id, fn) as Promise<T>,
        sleep: (id: string, duration: string) => step.sleep(id, duration),
      };
      const outcome = await runPublish({
        jobId: gate.jobId,
        tenantId,
        userId: gate.userId,
        step: publishStep,
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
        await transitionRun(db, tenantId, runId, 'publish_queued', 'failed', { failureReason: reason });
        return { status: 'FAILED' as const, reason, jobId: gate.jobId };
      });
    },
  );
}

export const executionPublishWorker = createExecutionPublishWorker();
