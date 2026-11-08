/**
 * TikTok Creator Preflight — Publish Plan
 *
 * Maps a caller's privacy intent onto what this creator is actually allowed to
 * do. The plan's honesty contract: it never returns a privacy level the creator
 * did not offer.
 *
 * Layer: tree (domain reusable logic — imports seed only)
 * @module tree/social/publisher/tiktok-creator-info-plan
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  CreatorInfoUnavailableError,
  type TikTokCreatorCapabilities,
  type TikTokPrivacyLevel,
} from './tiktok-creator-info-types';

export type RequestedPrivacy = 'public' | 'unlisted' | 'private' | 'self_only';

export interface TikTokPublishPlan {
  readonly privacyLevel: TikTokPrivacyLevel;
  readonly disableComment: boolean;
  readonly disableDuet: boolean;
  readonly disableStitch: boolean;
  /** True when the caller asked for something broader than TikTok granted. */
  readonly downgraded: boolean;
  /** Human-readable reason for the downgrade or the refusal, bilingual. */
  readonly note: string;
  readonly noteVi: string;
  /** The capability report the plan was derived from, for logging and receipts. */
  readonly capabilities: TikTokCreatorCapabilities;
}

export interface ResolvePublishPlanInput {
  readonly capabilities: TikTokCreatorCapabilities;
  readonly requested: RequestedPrivacy;
  readonly requestedCommentDisabled?: boolean;
  readonly requestedDuetDisabled?: boolean;
  readonly requestedStitchDisabled?: boolean;
  /**
   * `downgrade` keeps the publish going at the safest available level.
   * `refuse` throws instead, for callers that must not publish quietly.
   */
  readonly onUnavailable: 'downgrade' | 'refuse';
}

/**
 * Map a caller's intent onto what this creator is actually allowed to do.
 *
 * The mapping is deliberately conservative:
 * - a public request on a creator without `PUBLIC_TO_EVERYONE` becomes
 *   `SELF_ONLY` (the only level that never reaches strangers) or is refused;
 * - `unlisted` has no TikTok equivalent, so it degrades to `SELF_ONLY`;
 * - a switch the creator cannot control is left off rather than silently
 *   requested, because TikTok rejects unknown switch fields.
 */
export function resolveTikTokPublishPlan(input: ResolvePublishPlanInput): TikTokPublishPlan {
  const { capabilities, requested, onUnavailable } = input;
  const available = capabilities.availablePrivacyLevels;

  const prefersPublic = requested === 'public' || requested === 'unlisted';
  const canBePublic = available.includes('PUBLIC_TO_EVERYONE');

  let privacyLevel: TikTokPrivacyLevel;
  let downgraded = false;
  let note = '';
  let noteVi = '';

  if (prefersPublic && !canBePublic) {
    if (onUnavailable === 'refuse') {
      throw new CreatorInfoUnavailableError(
        'creator is not allowed to publish publicly; the app is likely still unaudited',
      );
    }
    privacyLevel = 'SELF_ONLY';
    downgraded = true;
    note = 'This TikTok account cannot publish publicly yet, so the video was saved privately instead of reaching strangers.';
    noteVi = 'Tài khoản TikTok chưa được phép đăng công khai nên video đã được lưu riêng tư thay vì hiện với mọi người.';
  } else if (prefersPublic) {
    privacyLevel = 'PUBLIC_TO_EVERYONE';
  } else if (requested === 'self_only' && !available.includes('SELF_ONLY')) {
    // Reported by TikTok for accounts under retention; keep it private anyway.
    privacyLevel = available.includes('MUTUAL_FOLLOW_FRIENDS') ? 'MUTUAL_FOLLOW_FRIENDS' : 'PUBLIC_TO_EVERYONE';
    downgraded = true;
    note = 'TikTok would not accept a private post for this account, so a narrower audience was used.';
    noteVi = 'TikTok không chấp nhận bài riêng tư cho tài khoản này nên đã dùng phạm vi hẹp hơn.';
  } else {
    privacyLevel = 'SELF_ONLY';
  }

  const disableComment = input.requestedCommentDisabled === true && capabilities.canDisableComment;
  const disableDuet = input.requestedDuetDisabled === true && capabilities.canDisableDuel;
  const disableStitch = input.requestedStitchDisabled === true && capabilities.canDisableStitch;

  return {
    privacyLevel,
    disableComment,
    disableDuet,
    disableStitch,
    downgraded,
    note,
    noteVi,
    capabilities,
  };
}

/**
 * Whether a video of the given length may be published at all under the
 * reported maximum duration. A duration of `0` means TikTok did not report a
 * limit, in which case the check is deferred to the platform rather than
 * failing a legitimate upload here.
 */
export function isDurationAllowed(
  capabilities: TikTokCreatorCapabilities,
  durationSeconds: number,
): boolean {
  if (capabilities.maxVideoDurationSeconds <= 0) return true;
  return durationSeconds <= capabilities.maxVideoDurationSeconds;
}

/** Bilingual operator-facing log line used when a publish is quietly downgraded. */
export function logPublishDowngrade(context: {
  readonly channelId: string;
  readonly jobId?: string;
  readonly plan: TikTokPublishPlan;
}): void {
  logger.warn('tiktok publish downgraded by creator_info preflight', {
    channelId: context.channelId,
    jobId: context.jobId,
    from: 'PUBLIC_TO_EVERYONE',
    to: context.plan.privacyLevel,
    availablePrivacyLevels: context.plan.capabilities.availablePrivacyLevels,
  });
}
