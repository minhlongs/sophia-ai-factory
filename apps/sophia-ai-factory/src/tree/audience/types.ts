/**
 * Audience Intelligence — shared types.
 *
 * Layer: tree (domain-reusable). May import seed only.
 * Timestamp discipline: every timestamp in this domain is MILLISECONDS,
 * matching performance_events.recorded_at (migration 0243).
 *
 * @module tree/audience/types
 */

/** Platforms with a metrics adapter (subset of the publishing platform union). */
export const AUDIENCE_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'facebook'] as const;

export type AudiencePlatform = (typeof AUDIENCE_PLATFORMS)[number];

/** Content formats a segment can be scored against. */
export const CONTENT_TYPES = ['short_video', 'long_video', 'image_post', 'article'] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/** Age buckets used in demographics JSON. */
export const AGE_BUCKETS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'] as const;

export type AgeBucket = (typeof AGE_BUCKETS)[number];

/** Demographics snapshot attached to a metrics row. */
export interface Demographics {
  /** Age bucket -> share of audience, values in [0, 1], sum <= 1. */
  ageBuckets?: Partial<Record<AgeBucket, number>>;
  /** Country code (ISO 3166-1 alpha-2) -> share of audience, values in [0, 1]. */
  countries?: Record<string, number>;
  /** Gender -> share of audience, values in [0, 1]. */
  genders?: Partial<Record<'male' | 'female' | 'other', number>>;
}

/** One audience segment definition (customer-owned, per workspace). */
export interface AudienceSegment {
  id: string;
  workspaceId: string;
  name: string;
  /** Platforms this segment is active on. */
  platforms: AudiencePlatform[];
  /** Content types this segment responds to. */
  contentTypes: ContentType[];
  /** Preferred age buckets (subset of AGE_BUCKETS). */
  ageBuckets: AgeBucket[];
  /** Preferred country codes (ISO alpha-2). Empty = all countries. */
  countries: string[];
  createdAt: number;
  updatedAt: number;
}

/** One platform metrics snapshot for one workspace + time window. */
export interface AudienceMetrics {
  id: string;
  workspaceId: string;
  platform: AudiencePlatform;
  followers: number;
  /** Engagement rate in [0, 1] (e.g. 0.042 = 4.2%). */
  engagementRate: number;
  demographics: Demographics;
  /** Window start, MILLISECONDS. */
  windowStartMs: number;
  /** Window end, MILLISECONDS. */
  windowEndMs: number;
  /** Row creation time, MILLISECONDS. */
  createdAt: number;
}

/** Raw metrics pulled from a platform API before persistence. */
export interface PlatformMetricsSnapshot {
  platform: AudiencePlatform;
  followers: number;
  engagementRate: number;
  demographics: Demographics;
}

/** One named contribution to a segment score — the explainability unit. */
export interface ScoreComponent {
  /** Stable machine name, e.g. 'platform_presence'. */
  name: string;
  /** Contribution in [0, 1]. Sum of all components equals the total score. */
  contribution: number;
  /** Maximum this component can contribute — weights are explicit, not hidden. */
  maxContribution: number;
  /** Human-readable reason for the contribution. */
  reason: string;
}

/** A segment ranked for one platform + content type. */
export interface RankedSegment {
  segment: AudienceSegment;
  platform: AudiencePlatform;
  contentType: ContentType;
  /** Total score in [0, 1] — exactly the sum of component contributions. */
  score: number;
  components: ScoreComponent[];
}
