/**
 * bundle-publisher.ts — Orchestrate one-click publish to a channel bundle
 *
 * Responsibilities:
 *   1. Filter out crypto-banned channels (if offer.vertical === 'crypto')
 *   2. Geo-translate caption per channel locale (Phase 05 — BYOK OpenRouter)
 *   3. Inject mandatory crypto disclaimer into caption (per channel jurisdiction)
 *   4. Call the distribute API (/api/v1/videos/[id]/distribute) per channel
 *   5. Return per-channel result: success | skipped(banned) | failed
 *
 * This module is called from the DistributePanel client component.
 * It is purely orchestration — no DB access.
 *
 * @module lib/publishing/bundle-publisher
 */

import type { ChannelProvider } from '@/land/video/publishing/providers/publisher-interface';
import type { BundleId } from '@/land/video/publishing/bundle-definitions';
import { getBundleChannels, CHANNEL_BUNDLES } from '@/land/video/publishing/bundle-definitions';
import { injectCryptoDisclaimer } from '@/land/video/publishing/crypto-caption-injector';
import { isChannelBannedForCrypto } from '@/seed/config/crypto-banned-channels';
import { translateCaption } from '@/seed/i18n/caption-translator';
import { getChannelCaptionRule } from '@/seed/i18n/channel-caption-rules';
import { logger } from '@/seed/utils/logger-utility';

export type ChannelResultStatus = 'success' | 'skipped' | 'failed';

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

/**
 * Publish a video to all channels in a bundle, applying crypto rules if needed.
 *
 * Calls POST /api/v1/videos/{videoId}/distribute per-channel.
 * Returns structured per-channel results for the UI.
 */
export async function publishToBundle(input: BundlePublishInput): Promise<BundlePublishResult> {
  const {
    videoId,
    bundleId,
    caption,
    scheduledAt,
    activeProviders,
    offerVertical,
    jurisdiction = 'US',
    locale = 'en',
    byokOpenRouterKey,
    captionSourceLocale = 'en',
    abExperimentId,
    abVariantOverride,
    abVariantCaptions,
  } = input;

  // Phase 06 — A/B variant selection
  // Determine which caption variant to use when an active experiment is present.
  let abVariantUsed: 'a' | 'b' | undefined;
  let activeCaption = caption;

  if (abExperimentId && abVariantCaptions) {
    // Use the caller-supplied variant (override) or default to 'a'
    abVariantUsed = abVariantOverride ?? 'a';
    activeCaption = abVariantUsed === 'a' ? abVariantCaptions.a : abVariantCaptions.b;
  }

  const isCrypto = offerVertical === 'crypto';

  // Get bundle channels that are actually connected by the user
  const connectedChannels = getBundleChannels(bundleId, activeProviders);

  const allBundleChannels = CHANNEL_BUNDLES[bundleId].channels;
  const results: ChannelPublishResult[] = [];

  for (const provider of allBundleChannels) {
    // Channel not connected by user
    if (!connectedChannels.includes(provider)) {
      results.push({
        provider,
        status: 'skipped',
        skipReason: 'not_connected',
      });
      continue;
    }

    // Crypto channel ban check
    if (isCrypto && isChannelBannedForCrypto(provider, jurisdiction)) {
      results.push({
        provider,
        status: 'skipped',
        skipReason: 'crypto_banned',
      });
      continue;
    }

    // --- Phase 05: Geo-translate caption per channel locale ---
    // Translation runs BEFORE crypto disclaimer injection so disclaimer
    // is appended to the already-localised caption (correct order).
    // Phase 06: use A/B-selected activeCaption instead of raw caption.
    const channelRule = getChannelCaptionRule(provider);
    let channelCaption = activeCaption;

    if (channelRule.targetLocale !== captionSourceLocale && channelRule.targetLocale !== 'source') {
      const translateResult = await translateCaption({
        source: activeCaption,
        targetLocale: channelRule.targetLocale,
        charCap: channelRule.charCap,
        byokKey: byokOpenRouterKey,
      });

      if (translateResult.warning) {
        logger.warn(`[bundle-publisher] ${provider}: ${translateResult.warning}`);
      }
      channelCaption = translateResult.caption;
    } else {
      // Same locale — just enforce char cap, skip LLM call
      channelCaption = channelRule.charCap > 0 && activeCaption.length > channelRule.charCap
        ? activeCaption.slice(0, channelRule.charCap - 1) + '…'
        : activeCaption;
    }

    // Inject crypto disclaimer into caption for allowed channels
    let finalCaption = channelCaption;
    if (isCrypto) {
      const injectionResult = await injectCryptoDisclaimer({
        caption: channelCaption,
        vertical: offerVertical,
        targetJurisdiction: jurisdiction,
        channelId: provider,
        locale,
      });

      if (injectionResult.blocked) {
        results.push({
          provider,
          status: 'skipped',
          skipReason: injectionResult.blockReason ?? 'crypto_blocked',
        });
        continue;
      }

      finalCaption = injectionResult.caption;
    }

    // Call the distribute API
    try {
      const res = await fetch(`/api/v1/videos/${videoId}/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelProviders: [provider],
          caption: finalCaption || undefined,
          scheduledAt,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string };
        results.push({
          provider,
          status: 'failed',
          errorMessage: errorData.error ?? `HTTP ${res.status}`,
        });
        continue;
      }

      const data = (await res.json()) as { jobIds?: string[] };
      results.push({
        provider,
        status: 'success',
        jobId: data.jobIds?.[0],
      });
    } catch (err) {
      results.push({
        provider,
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Network error',
      });
    }
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  const skippedCount = results.filter((r) => r.status === 'skipped').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  return { bundleId, channels: results, successCount, skippedCount, failedCount, abVariantUsed };
}
