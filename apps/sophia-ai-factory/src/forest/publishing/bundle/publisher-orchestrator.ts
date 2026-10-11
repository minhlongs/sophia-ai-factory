/**
 * Bundle Publisher Orchestrator
 * Layer: forest/publishing/bundle
 */

import { getBundleChannels, CHANNEL_BUNDLES } from '../bundle-definitions'
import { isChannelBannedForCrypto } from '@/seed/config/crypto-banned-channels'
import type {
  BundlePublishInput,
  BundlePublishResult,
  ChannelPublishResult,
} from './types'
import { prepareChannelCaption } from './caption-pipeline'
import { dispatchChannelPublish } from './distribution-dispatcher'

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
  } = input

  // Phase 06 — A/B variant selection
  let abVariantUsed: 'a' | 'b' | undefined
  let activeCaption = caption

  if (abExperimentId && abVariantCaptions) {
    abVariantUsed = abVariantOverride ?? 'a'
    activeCaption = abVariantUsed === 'a' ? abVariantCaptions.a : abVariantCaptions.b
  }

  const isCrypto = offerVertical === 'crypto'
  const connectedChannels = getBundleChannels(bundleId, activeProviders)
  const allBundleChannels = CHANNEL_BUNDLES[bundleId].channels
  const results: ChannelPublishResult[] = []

  for (const provider of allBundleChannels) {
    // Channel not connected by user
    if (!connectedChannels.includes(provider)) {
      results.push({
        provider,
        status: 'skipped',
        skipReason: 'not_connected',
      })
      continue
    }

    // Crypto channel ban check
    if (isCrypto && isChannelBannedForCrypto(provider, jurisdiction)) {
      results.push({
        provider,
        status: 'skipped',
        skipReason: 'crypto_banned',
      })
      continue
    }

    // Prepare caption (geo-translate & crypto disclaimers)
    const captionResult = await prepareChannelCaption({
      provider,
      activeCaption,
      captionSourceLocale,
      byokOpenRouterKey,
      isCrypto,
      offerVertical,
      jurisdiction,
      locale,
    })

    if (captionResult.blocked) {
      results.push({
        provider,
        status: 'skipped',
        skipReason: captionResult.blockReason ?? 'crypto_blocked',
      })
      continue
    }

    // Dispatch to channel distribute API
    const dispatchResult = await dispatchChannelPublish({
      videoId,
      provider,
      caption: captionResult.caption,
      scheduledAt,
    })
    results.push(dispatchResult)
  }

  const successCount = results.filter((r) => r.status === 'success').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length
  const failedCount = results.filter((r) => r.status === 'failed').length

  return { bundleId, channels: results, successCount, skippedCount, failedCount, abVariantUsed }
}
