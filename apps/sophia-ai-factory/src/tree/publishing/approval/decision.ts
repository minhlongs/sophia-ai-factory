/**
 * Publish Approval Decision
 * Layer: TREE (domain-specific reusable)
 *
 * Decides, per publish, whether a human must approve before the media reaches
 * the channel. The decision is evaluated for every job rather than once for a
 * whole batch, because a batch can contain one memo-worthy item and nineteen
 * routine ones, and "the CEO approved the campaign" must not be read as "the
 * CEO approved this post".
 *
 * @module tree/publishing/approval/decision
 */

import type {
  PublishApprovalDecision,
  PublishApprovalState,
  PublishLedgerRecord,
} from './types';

/** Privacy levels that expose the media beyond the workspace. */
const PUBLIC_INTENTS = new Set(['public', 'unlisted']);

/**
 * Whether the requested privacy puts the media in front of anyone outside the
 * workspace. A publish the caller never flagged is treated as private, because
 * the safe reading of "unspecified" is "not public".
 */
export function isPublicPublishIntent(requestedPrivacy?: string): boolean {
  return PUBLIC_INTENTS.has((requestedPrivacy ?? '').trim().toLowerCase());
}

export interface PublishApprovalPolicyInput {
  /** Privacy the caller asked for; anything not listed here stays private. */
  readonly requestedPrivacy?: string;
  /** Whether the workspace opted out of per-publish approval (autonomy). */
  readonly approvalDisabled?: boolean;
  /** Whether a prior approval for this exact subject already exists. */
  readonly existingApproval?: Pick<PublishLedgerRecord, 'decision' | 'expiresAt'> | null;
  /**
   * Injectable clock returning epoch **seconds**, the unit the ledger stores
   * `expires_at` in. Mixing a millisecond clock in here is what makes an
   * expiry read as a thousand times overdue, so the unit is part of the type.
   */
  readonly nowSeconds?: () => number;
}

/** Epoch seconds, the unit every timestamp in the publish ledger is stored in. */
export function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

const NEEDS_APPROVAL = {
  reason: 'This publish goes to a public channel, so it needs your approval before it is posted.',
  reasonVi: 'Bài đăng này lên kênh công khai nên cần bạn xác nhận trước khi được đăng.',
};

const DISABLED = {
  reason: 'This workspace turned off publish approval, so the post went out without a human check.',
  reasonVi: 'Không gian làm việc này đã tắt bước xác nhận trước khi đăng nên bài viết đã được đăng mà không có người kiểm duyệt.',
};

function isExpired(
  approval: Pick<PublishLedgerRecord, 'expiresAt'>,
  nowSeconds: () => number,
): boolean {
  if (approval.expiresAt === undefined) return false;
  return approval.expiresAt <= nowSeconds();
}

/**
 * Reduces the policy inputs to the one of three outcomes the caller acts on.
 * A blocked outcome only ever comes from a decision that has been made and is
 * no longer good — a rejection, or an approval that lapsed before it was used.
 * An expired approval must be terminal rather than re-requestable, otherwise a
 * worker that keeps timing out would re-enqueue a human decision forever.
 */
export function evaluatePublishApprovalPolicy(
  input: PublishApprovalPolicyInput,
): PublishApprovalState {
  const nowSeconds = input.nowSeconds ?? nowEpochSeconds;
  const intent = isPublicPublishIntent(input.requestedPrivacy);

  if (!intent) {
    return { outcome: 'allowed' };
  }

  if (input.approvalDisabled === true) {
    return { outcome: 'allowed' };
  }

  const existing = input.existingApproval ?? null;
  if (existing && existing.decision === 'approved') {
    if (!isExpired(existing, nowSeconds)) {
      return { outcome: 'allowed' };
    }
    return {
      outcome: 'blocked',
      reason: 'The approval for this publish lapsed before it was used, so it must be requested again.',
      reasonVi: 'Xác nhận cho lần đăng này đã hết hạn trước khi dùng nên cần yêu cầu lại.',
    };
  }

  if (existing && existing.decision === 'rejected') {
    return {
      outcome: 'blocked',
      reason: 'This publish was rejected, so it was not posted.',
      reasonVi: 'Yêu cầu đăng này đã bị từ chối nên bài viết chưa được đăng.',
    };
  }

  if (existing && existing.decision === 'expired') {
    return { outcome: 'blocked', ...EXPIRED_APPROVAL_REASON };
  }

  return { outcome: 'needs_approval', ...NEEDS_APPROVAL };
}

/** Whether a stored decision still permits a publish to proceed. */
export function ledgerDecisionAllowsPublish(
  decision: PublishApprovalDecision,
  expiresAt: number | undefined,
  nowSeconds: () => number = nowEpochSeconds,
): boolean {
  if (decision !== 'approved') return false;
  if (expiresAt !== undefined && expiresAt <= nowSeconds()) return false;
  return true;
}

/** Bilingual reason recorded when an approval lapses unused. */
export const EXPIRED_APPROVAL_REASON = {
  reason: 'The approval lapsed before the publish ran.',
  reasonVi: 'Xác nhận đã hết hạn trước khi bài viết được đăng.',
} as const;

/** Exposed for operators who disable the gate entirely. */
export const APPROVAL_DISABLED_NOTE = DISABLED;
