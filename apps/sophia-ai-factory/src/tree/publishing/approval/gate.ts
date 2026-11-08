/**
 * Publish Approval Gate
 * Layer: TREE (domain-specific reusable)
 *
 * A publish to a public channel waits here for a human decision before any
 * media leaves the worker. The gate reads the ledger first, so a publish that
 * was already approved is released without asking again, and a re-delivered
 * event that arrives while the request is still pending re-joins the same wait
 * instead of enqueueing a second human decision.
 *
 * @module tree/publishing/approval/gate
 */

import { logger } from '@/seed/utils/logger-utility';
import { evaluatePublishApprovalPolicy, isPublicPublishIntent, nowEpochSeconds } from './decision';
import { claimPublishApprovalRequest, getPublishLedgerRecord } from './ledger-store';
import type {
  PublishApprovalDecision,
  PublishApprovalState,
  PublishApprovalStep,
  PublishApprovalSubject,
} from './types';

/** Event names for the publish approval round-trip. */
export const PUBLISH_APPROVAL_REQUESTED_EVENT = 'publish.approval.requested';
export const PUBLISH_APPROVAL_RESOLVED_EVENT = 'publish.approval.resolved';

/** How long a human has to answer before the publish gives up (72 hours). */
export const PUBLISH_APPROVAL_TIMEOUT_MS = 72 * 60 * 60 * 1000;

export interface PublishApprovalGateInput extends PublishApprovalSubject {
  readonly requestedPrivacy?: string;
  readonly approvalDisabled?: boolean;
  /** Injectable clock in epoch seconds, matching the ledger's stored unit. */
  readonly nowSeconds?: () => number;
  /** Retry attempt index, which keeps step ids unique across retries. */
  readonly attempt?: number;
}

export interface PublishApprovalGateResult {
  readonly state: PublishApprovalState;
  readonly decision?: PublishApprovalDecision;
  readonly reviewerId?: string;
}

/**
 * Runs the gate. Returns `allowed` when the publish may proceed and `blocked`
 * when it must not — a private intent, a rejection, an expired approval, or an
 * approval timeout are all terminal for this delivery.
 */
export async function awaitPublishApproval(
  input: PublishApprovalGateInput,
  step: PublishApprovalStep,
): Promise<PublishApprovalGateResult> {
  const nowSeconds = input.nowSeconds ?? nowEpochSeconds;
  const attempt = input.attempt ?? 0;

  // Intent is checked before any ledger read: a private publish needs no human,
  // so spending a D1 round trip on one is pure waste.
  if (!isPublicPublishIntent(input.requestedPrivacy)) {
    return { state: { outcome: 'allowed' } };
  }
  if (input.approvalDisabled === true) {
    return { state: { outcome: 'allowed' } };
  }

  let existing = await step.run(`publish-approval-read-${attempt}`, () =>
    getPublishLedgerRecord(input),
  );
  let state = evaluatePublishApprovalPolicy({
    requestedPrivacy: input.requestedPrivacy,
    approvalDisabled: input.approvalDisabled,
    existingApproval: existing,
    nowSeconds,
  });

  if (state.outcome !== 'needs_approval') {
    return {
      state,
      decision: existing?.decision,
      reviewerId: existing?.reviewerId,
    };
  }

  const expiresAt = nowSeconds() + Math.floor(PUBLISH_APPROVAL_TIMEOUT_MS / 1000);
  const claim = await step.run(`publish-approval-claim-${attempt}`, () =>
    claimPublishApprovalRequest({ ...input, expiresAt }),
  );

  if (!claim.claimed) {
    // Another delivery already enqueued the human decision for this exact
    // subject, so this one waits for that decision instead of creating a second.
    logger.info('publishApproval: request already claimed by another delivery', {
      key: claim.key,
      platform: input.platform,
      channelId: input.channelId,
    });
    await step.waitForEvent(`publish-approval-wait-${claim.key}-a${attempt}`, {
      event: PUBLISH_APPROVAL_RESOLVED_EVENT,
      timeout: PUBLISH_APPROVAL_TIMEOUT_MS,
    });
    return settleFromLedger(step, input, attempt, nowSeconds);
  }

  await step.sendEvent(`publish-approval-emit-${claim.key}`, {
    name: PUBLISH_APPROVAL_REQUESTED_EVENT,
    data: {
      idempotencyKey: claim.key,
      tenantId: input.tenantId,
      channelId: input.channelId,
      platform: input.platform,
      mediaRef: input.mediaRef,
      requestedPrivacy: input.requestedPrivacy ?? 'public',
    },
  });

  const resolved = await step.waitForEvent(`publish-approval-wait-${claim.key}-a${attempt}`, {
    event: PUBLISH_APPROVAL_RESOLVED_EVENT,
    timeout: PUBLISH_APPROVAL_TIMEOUT_MS,
  });

  if (resolved === null) {
    logger.warn('publishApproval: no decision before timeout, publish withheld', {
      platform: input.platform,
      channelId: input.channelId,
    });
    return { state: { outcome: 'blocked', ...EXPIRED_REASONS }, decision: 'expired' };
  }

  // The event is only the wake-up. The ledger is the record of the human's
  // decision, and re-reading it means a resolution written by a different path
  // is honoured rather than trusted from an event payload.
  existing = await step.run(`publish-approval-resettle-${attempt}`, () => getPublishLedgerRecord(input));
  state = evaluatePublishApprovalPolicy({
    requestedPrivacy: input.requestedPrivacy,
    approvalDisabled: input.approvalDisabled,
    existingApproval: existing,
    nowSeconds,
  });

  if (state.outcome === 'allowed') {
    return { state, decision: existing?.decision, reviewerId: existing?.reviewerId };
  }
  return { state, decision: existing?.decision ?? 'rejected', reviewerId: existing?.reviewerId };
}

/**
 * Re-reads the ledger after a shared wait and reduces it to a terminal result.
 * Used by a delivery that did not own the request, so it answers from the same
 * record the owner wrote rather than from the event payload it was woken by.
 */
async function settleFromLedger(
  step: PublishApprovalStep,
  input: PublishApprovalGateInput,
  attempt: number,
  nowSeconds: () => number,
): Promise<PublishApprovalGateResult> {
  const record = await step.run(`publish-approval-resettle-${attempt}`, () =>
    getPublishLedgerRecord(input),
  );
  const state = evaluatePublishApprovalPolicy({
    requestedPrivacy: input.requestedPrivacy,
    approvalDisabled: input.approvalDisabled,
    existingApproval: record,
    nowSeconds,
  });
  if (state.outcome === 'allowed') {
    return { state, decision: record?.decision, reviewerId: record?.reviewerId };
  }
  return { state, decision: record?.decision ?? 'rejected', reviewerId: record?.reviewerId };
}

const EXPIRED_REASONS = {
  reason: 'No approval arrived within 72 hours, so the publish was withheld.',
  reasonVi: 'Không có xác nhận trong vòng 72 giờ nên bài viết đã được tạm giữ lại.',
} as const;
