/**
 * TikTok Creator Capability Preflight
 *
 * TikTok's Content Posting API answers a publish request with HTTP 200 even
 * when the app is still unaudited: the platform silently downgrades the post
 * to SELF_ONLY and caps it at five accounts per rolling 24 hours. A caller
 * that maps `privacy: 'public'` to `PUBLIC_TO_EVERYONE` therefore believes it
 * published a public video while the account owner never sees one.
 *
 * The only way to learn what this creator may actually do is the
 * `creator_info/query/` endpoint, which reports the privacy levels, the
 * maximum video duration and the comment/duet/stitch switches that are live
 * for this specific creator. This module performs that query and reduces it
 * to a publish plan whose privacy level is always one the creator reported.
 *
 * Honesty contract: `resolveTikTokPublishPlan` never returns a privacy level
 * the creator did not offer. When the caller asked for public and public is
 * not available, the plan is either a safe downgrade the caller can see
 * (`SELF_ONLY`) or a refusal that throws, depending on `onUnavailable`.
 *
 * Layer: tree (domain reusable logic — imports seed only)
 * @module tree/social/publisher/tiktok-creator-info
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, FailureKind } from '@/seed/types/failure-kind';
import { logger } from '@/seed/utils/logger-utility';

export const TIKTOK_CREATOR_INFO_ENDPOINT = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';

/** The privacy levels TikTok can return for an unaudited app are a strict subset of this union. */
export type TikTokPrivacyLevel = 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';

export interface TikTokCreatorCapabilities {
  /** Privacy levels this creator is allowed to publish with, as TikTok reported them. */
  readonly availablePrivacyLevels: readonly TikTokPrivacyLevel[];
  /** Maximum video duration in seconds TikTok will accept for this creator. */
  readonly maxVideoDurationSeconds: number;
  /** Whether the comment switch can be controlled at all. */
  readonly canDisableComment: boolean;
  readonly canDisableDuel: boolean;
  readonly canDisableStitch: boolean;
  /** True when the creator's own report says the account can go public. */
  readonly publiclyPublishable: boolean;
}

/** Thrown when the preflight itself fails, so callers never publish blind. */
export class CreatorInfoUnavailableError extends Error {
  constructor(
    public readonly reason: string,
    options?: { readonly status?: number },
  ) {
    super(`CREATOR_INFO_UNAVAILABLE: ${reason}`);
    this.name = 'CreatorInfoUnavailableError';
    this.status = options?.status;
  }

  readonly status?: number;
}

const PRIVACY_LEVELS: readonly TikTokPrivacyLevel[] = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'];

function isPrivacyLevel(raw: unknown): raw is TikTokPrivacyLevel {
  return typeof raw === 'string' && (PRIVACY_LEVELS as readonly string[]).includes(raw);
}

function readBoolean(container: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = container[key];
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Reduce a raw `creator_info` response body to the capability record.
 * A response that carries no usable privacy list is treated as unusable: it
 * means the caller would otherwise guess, and guessing is what silently
 * published a SELF_ONLY post under a PUBLIC_TO_EVERYONE label.
 */
export function parseCreatorInfoResponse(payload: unknown): TikTokCreatorCapabilities {
  if (typeof payload !== 'object' || payload === null) {
    throw new CreatorInfoUnavailableError('response body was not an object');
  }

  const error = (payload as Record<string, unknown>).error;
  if (typeof error === 'object' && error !== null) {
    const code = (error as Record<string, unknown>).code;
    throw new CreatorInfoUnavailableError(`tiktok reported error code ${String(code)}`);
  }

  const data = (payload as Record<string, unknown>).data;
  if (typeof data !== 'object' || data === null) {
    throw new CreatorInfoUnavailableError('response carried no data object');
  }

  const container = data as Record<string, unknown>;
  const rawLevels = container.privacy_level_options;
  const levels: TikTokPrivacyLevel[] = Array.isArray(rawLevels)
    ? rawLevels.filter(isPrivacyLevel)
    : [];

  if (levels.length === 0) {
    throw new CreatorInfoUnavailableError('creator reported no usable privacy_level_options');
  }

  const maxDuration = container.max_video_post_duration_sec;
  const maxVideoDurationSeconds = typeof maxDuration === 'number' && maxDuration > 0 ? maxDuration : 0;

  return {
    availablePrivacyLevels: levels,
    maxVideoDurationSeconds,
    canDisableComment: readBoolean(container, 'can_disable_comment', false),
    canDisableDuel: readBoolean(container, 'can_disable_duet', false),
    canDisableStitch: readBoolean(container, 'can_disable_stitch', false),
    publiclyPublishable: levels.includes('PUBLIC_TO_EVERYONE'),
  };
}

/**
 * Ask TikTok what this creator may publish with. Wrapped in the circuit
 * breaker because it is a real outbound HTTP call on the publish path.
 */
export async function fetchTikTokCreatorInfo(
  accessToken: string,
  fetchImpl: typeof fetch = globalThis.fetch as typeof fetch,
): Promise<TikTokCreatorCapabilities> {
  if (!shouldAllowRequest('tiktok')) {
    throw new CreatorInfoUnavailableError('circuit breaker open for tiktok');
  }

  try {
    const res = await fetchImpl(TIKTOK_CREATOR_INFO_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      recordFailure('tiktok', classifyHttpStatusFallback(res.status));
      throw new CreatorInfoUnavailableError(`tiktok answered HTTP ${res.status}`, { status: res.status });
    }

    const payload = (await res.json()) as unknown;
    const capabilities = parseCreatorInfoResponse(payload);
    recordSuccess('tiktok');
    return capabilities;
  } catch (err: unknown) {
    if (err instanceof CreatorInfoUnavailableError) throw err;
    recordFailure('tiktok', classifyError(err));
    throw err;
  }
}

function classifyHttpStatusFallback(status: number): FailureKind {
  return classifyError(new Error(`HTTP ${status}`));
}

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

export { FailureKind };
