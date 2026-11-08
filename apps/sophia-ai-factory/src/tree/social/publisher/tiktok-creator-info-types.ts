/**
 * TikTok Creator Preflight — Types & Parser
 *
 * TikTok's Content Posting API answers a publish request with HTTP 200 even
 * when the app is still unaudited: the platform silently downgrades the post
 * to SELF_ONLY and caps it at five accounts per rolling 24 hours. The only way
 * to learn what a creator may actually do is the `creator_info/query/` response.
 *
 * This module holds the capability record, the refusal error and the parser that
 * reduces a raw response body to that record without guessing.
 *
 * Layer: tree (domain reusable logic — imports seed only)
 * @module tree/social/publisher/tiktok-creator-info-types
 */

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
  readonly status?: number;

  constructor(
    public readonly reason: string,
    options?: { readonly status?: number },
  ) {
    super(`CREATOR_INFO_UNAVAILABLE: ${reason}`);
    this.name = 'CreatorInfoUnavailableError';
    this.status = options?.status;
  }
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
