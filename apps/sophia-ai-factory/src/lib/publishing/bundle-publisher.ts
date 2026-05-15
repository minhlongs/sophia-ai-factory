/**
 * bundle-publisher.ts — Orchestrate one-click publish to a channel bundle
 *
 * Responsibilities:
 *   1. Filter out crypto-banned channels (if offer.vertical === 'crypto')
 *   2. Inject mandatory crypto disclaimer into caption (per channel jurisdiction)
 *   3. Call the distribute API (/api/v1/videos/[id]/distribute) per channel
 *   4. Return per-channel result: success | skipped(banned) | failed
 *
 * This module is called from the DistributePanel client component.
 * It is purely orchestration — no DB access.
 *
 * @module lib/publishing/bundle-publisher
 */

import type { ChannelProvider } from './publisher-interface';
import type { BundleId } from './bundle-definitions';
import { getBundleChannels, CHANNEL_BUNDLES } from './bundle-definitions';
import { injectCryptoDisclaimer } from './crypto-caption-injector';
import { isChannelBannedForCrypto } from '@/seed/config/crypto-banned-channels';

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
  } = input;

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

    // Inject crypto disclaimer into caption for allowed channels
    let finalCaption = caption;
    if (isCrypto) {
      const injectionResult = injectCryptoDisclaimer({
        caption,
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

  return { bundleId, channels: results, successCount, skippedCount, failedCount };
}
