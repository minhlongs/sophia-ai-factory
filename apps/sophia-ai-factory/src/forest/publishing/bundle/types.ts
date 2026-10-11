/**
 * Bundle Publisher Types & Interfaces
 * Layer: forest/publishing/bundle
 */

import type { ChannelProvider } from '../publisher-interface'
import type { BundleId } from '../bundle-definitions'

export const SERVICE_NAME = 'bundle-publisher' as const

export type ChannelResultStatus = 'success' | 'skipped' | 'failed'

export interface ChannelPublishResult {
  provider: ChannelProvider;
  status: ChannelResultStatus;
  jobId?: string;
  /** Present when status === 'skipped' — explains the reason. */
  skipReason?: string;
  /** Present when status === 'failed'. */
  errorMessage?: string;
}

export interface BundlePublishInput {
  videoId: string;
  bundleId: BundleId;
  caption: string;
  scheduledAt?: number;
  /** Providers connected in user's account (must be active). */
  activeProviders: Set<string>;
  /** If set, crypto rules apply (disclaimer injection + channel filtering). */
  offerVertical?: string;
  /** Jurisdiction used for crypto disclaimer text. Defaults to 'US'. */
  jurisdiction?: string;
  /** Locale for disclaimer text. Defaults to 'en'. */
  locale?: 'en' | 'vi';
  /**
   * User's BYOK OpenRouter API key for geo-translation.
   * If absent, translation is skipped and original caption is used.
   */
  byokOpenRouterKey?: string;
  /**
   * Source language of the caption (BCP-47). Defaults to 'en'.
   * Translation is skipped when targetLocale === sourceLocale.
   */
  captionSourceLocale?: string;
  /**
   * Phase 06: Active A/B experiment ID for this video.
   * When set, the publish alternates caption between variant A and B
   * using a simple round-robin counter (odd publish index → A, even → B).
   * Callers can supply `abVariantOverride` to force a specific variant.
   */
  abExperimentId?: string;
  /** Force a specific A/B variant ('a' | 'b'). Ignored when abExperimentId absent. */
  abVariantOverride?: 'a' | 'b';
  /** Pre-fetched A/B captions. Supply these to avoid a D1 read in the publisher. */
  abVariantCaptions?: { a: string; b: string };
}

export interface BundlePublishResult {
  bundleId: BundleId;
  channels: ChannelPublishResult[];
  /** Count of successfully scheduled jobs. */
  successCount: number;
  /** Count of skipped (banned/not-connected) channels. */
  skippedCount: number;
  /** Count of channels where publish failed. */
  failedCount: number;
  /** Phase 06: which A/B variant was used for this publish ('a' | 'b' | undefined). */
  abVariantUsed?: 'a' | 'b';
}
