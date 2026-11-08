/**
 * Human-approval gate for a publish that reaches a public channel.
 *
 * The media is resolved here rather than by the upload step because the gate
 * keys the human decision on the media reference: an untrusted or missing video
 * has to fail before a human is asked about it, and the upload has to receive
 * the same verified URL the decision was made against.
 *
 * @module land/video/publishing/publish-approval-guard
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { awaitPublishApproval, type PublishApprovalStep } from '@/tree/publishing/approval';
import {
  VideoNotFoundError,
  VideoUnauthorizedError,
} from '@/land/video/storage/get-canonical-video-url';
import type { PublishingJob } from '@/seed/types';
import type { Step, StepEventTools, ClaimResult } from './publish-types';
import { resolveVideoUrlOrFail, assertSafeVideoUrl, sanitizeError } from './publish-url-utils';

/** Either the publish is released with its media, or it stops with a terminal result. */
export type PublishApprovalGateOutcome =
  | { readonly kind: 'proceed'; readonly videoUrl: string }
  | { readonly kind: 'stop'; readonly result: ClaimResult };

/**
 * Combines the step's memoized `run` with the event tools into the surface the
 * approval gate waits on. A runtime that cannot emit or await events cannot host
 * a human decision, so a missing tool is refused here rather than letting an
 * unrequested approval read as a satisfied one.
 */
function toApprovalStepContext(step: Step, eventTools?: StepEventTools): PublishApprovalStep {
  if (!eventTools) {
    throw new Error('[publishExecute] Publish approval requires an event-capable step runtime');
  }
  return {
    run: <T,>(id: string, fn: () => Promise<T>): Promise<T> => step.run(id, fn) as Promise<T>,
    sendEvent: eventTools.sendEvent,
    waitForEvent: eventTools.waitForEvent,
  };
}

export interface PublishApprovalGateArgs {
  db: ReturnType<typeof createServerClient>;
  jobId: string;
  job: PublishingJob;
  tenantId: string;
  requesterId?: string;
  step: Step;
  eventTools?: StepEventTools;
  logTag?: string;
}

/**
 * Resolves the media, then runs the approval gate. A publish to a public channel
 * cannot be taken back, so a human decides it after the claim proved this
 * delivery owns the job and before any media reaches a provider.
 *
 * `publishing_jobs.privacy_status` defaults to `public`, and an absent value
 * means unlisted-or-public rather than private, so the unset case asks for a
 * decision instead of silently skipping the gate.
 */
export async function runPublishApprovalGate(args: PublishApprovalGateArgs): Promise<PublishApprovalGateOutcome> {
  const { db, jobId, job, tenantId, requesterId, step, eventTools, logTag = 'publishExecute' } = args;

  let videoUrl: string;
  try {
    videoUrl = await resolveVideoUrlOrFail({ jobId, videoId: job.video_id, userId: tenantId, db, logTag });
  } catch (urlErr) {
    if (urlErr instanceof VideoNotFoundError || urlErr instanceof VideoUnauthorizedError) {
      return {
        kind: 'stop',
        result: { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' },
      };
    }
    throw urlErr;
  }
  assertSafeVideoUrl(videoUrl);

  const approval = await awaitPublishApproval(
    {
      tenantId,
      channelId: job.channel_id,
      platform: job.provider ?? '',
      mediaRef: videoUrl,
      requestedPrivacy: job.privacy_status ?? 'public',
      requesterId: requesterId || tenantId,
      approvalDisabled: false,
    },
    toApprovalStepContext(step, eventTools),
  );

  if (approval.state.outcome === 'allowed') {
    return { kind: 'proceed', videoUrl };
  }

  const reason = approval.state.outcome === 'blocked'
    ? approval.state.reason
    : 'Awaiting human approval before publish';
  logger.info(`[${logTag}] Publish withheld pending approval`, {
    jobId,
    outcome: approval.state.outcome,
    decision: approval.decision,
    reviewerId: approval.reviewerId,
  });
  await db.from('publishing_jobs').update({
    status: 'failed',
    error: sanitizeError(reason).slice(0, 200),
  }).eq('id', jobId);

  return {
    kind: 'stop',
    result: { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '', error: reason },
  };
}
