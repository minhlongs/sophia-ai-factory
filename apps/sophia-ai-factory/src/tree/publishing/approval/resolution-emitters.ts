/**
 * Publish approval resolution — ledger write plus the event that wakes the wait.
 *
 * The ledger is the durable record of a reviewer's decision. The event only
 * wakes a suspended publish, so it is sent after the ledger write succeeds and
 * its failure never leaves the job believing a decision was recorded.
 *
 * Layer: tree (domain-specific reusable).
 *
 * @module tree/publishing/approval/resolution-emitters
 */

import type { D1Database } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resolvePublishApproval } from './ledger-store';
import { PUBLISH_APPROVAL_RESOLVED_EVENT } from './gate';
import type { PublishApprovalSubject } from './types';

export interface PublishApprovalResolutionInput extends PublishApprovalSubject {
  decision: 'approved' | 'rejected';
  reviewerId: string;
  comment?: string;
  db?: D1Database;
}

export interface PublishApprovalResolutionOutcome {
  /** Whether this reviewer's decision became the recorded one. */
  resolved: boolean;
  /** Set when the ledger reported the decision was already recorded. */
  alreadyResolved: boolean;
  /** Set when the ledger could not be written at all. */
  error?: string;
}

/**
 * Records a reviewer's decision in the ledger, then emits the wake-up event.
 * A second reviewer answering the same request loses the ledger write, so their
 * decision is reported back as superseded and the waiting job is woken for the
 * decision that actually stands.
 */
export async function resolveAndAnnouncePublishApproval(
  input: PublishApprovalResolutionInput,
): Promise<PublishApprovalResolutionOutcome> {
  const { decision, reviewerId, comment, db } = input;
  const subject: PublishApprovalSubject = {
    tenantId: input.tenantId,
    channelId: input.channelId,
    platform: input.platform,
    mediaRef: input.mediaRef,
  };

  const write = await resolvePublishApproval({ subject, decision, reviewerId, comment }, db);
  if (write.ok) {
    logger.info('publishApproval: decision recorded and waiting publish woken', {
      subject: subject.platform,
      channelId: subject.channelId,
      decision,
      reviewerId,
    });
    await announcePublishApprovalResolved({
      idempotencyKey: write.value.idempotencyKey,
      tenantId: subject.tenantId,
      channelId: subject.channelId,
      platform: subject.platform,
      mediaRef: subject.mediaRef,
      decision,
      reviewerId,
      comment,
    });
    return { resolved: true, alreadyResolved: false };
  }

  const { code } = write.error;
  if (code === 'ALREADY_RESOLVED') {
    logger.info('publishApproval: decision superseded by an earlier reviewer', {
      channelId: subject.channelId,
      decision,
      reviewerId,
    });
    // The key is not known here, but the waiting job re-reads the ledger when it
    // wakes, so the payload only has to wake it — the record answers the rest.
    await announcePublishApprovalResolved({
      idempotencyKey: '',
      tenantId: subject.tenantId,
      channelId: subject.channelId,
      platform: subject.platform,
      mediaRef: subject.mediaRef,
      decision,
      reviewerId,
      comment,
    });
    return { resolved: false, alreadyResolved: true };
  }

  logger.error('publishApproval: decision could not be recorded, publish stays withheld', {
    code,
    channelId: subject.channelId,
  });
  return { resolved: false, alreadyResolved: false, error: code };
}

/**
 * Non-fatal wake-up. A job that misses this event still resolves correctly,
 * because it re-reads the ledger the moment it wakes for any reason.
 */
async function announcePublishApprovalResolved(payload: {
  idempotencyKey: string;
  tenantId: string;
  channelId: string;
  platform: string;
  mediaRef: string;
  decision: 'approved' | 'rejected';
  reviewerId: string;
  comment?: string;
}): Promise<void> {
  try {
    await inngest.send({
      name: PUBLISH_APPROVAL_RESOLVED_EVENT,
      data: {
        idempotencyKey: payload.idempotencyKey,
        tenantId: payload.tenantId,
        channelId: payload.channelId,
        platform: payload.platform,
        decision: payload.decision,
        reviewerId: payload.reviewerId,
        comment: payload.comment,
      },
    });
  } catch (err) {
    logger.warn('publishApproval: resolved wake-up event failed (non-fatal)', {
      error: toError(err).message,
      channelId: payload.channelId,
    });
  }
}
