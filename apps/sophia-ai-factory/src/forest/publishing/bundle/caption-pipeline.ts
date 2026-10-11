/**
 * Channel Caption Pipeline (Translation & Crypto Disclaimers)
 * Layer: forest/publishing/bundle
 */

import type { ChannelProvider } from '../publisher-interface'
import { injectCryptoDisclaimer } from '../crypto-caption-injector'
import { translateCaption } from '@/land/i18n/caption-translator'
import { getChannelCaptionRule } from '@/land/i18n/channel-caption-rules'
import { logger } from '@/seed/utils/logger-utility'

export interface PrepareChannelCaptionOptions {
  provider: ChannelProvider;
  activeCaption: string;
  captionSourceLocale: string;
  byokOpenRouterKey?: string;
  isCrypto: boolean;
  offerVertical?: string;
  jurisdiction: string;
  locale: 'en' | 'vi';
}

export interface PrepareChannelCaptionResult {
  caption?: string;
  blocked: boolean;
  blockReason?: string;
}

/**
 * Translates captions per channel rules and injects crypto compliance disclaimers.
 */
export async function prepareChannelCaption(
  opts: PrepareChannelCaptionOptions
): Promise<PrepareChannelCaptionResult> {
  const {
    provider,
    activeCaption,
    captionSourceLocale,
    byokOpenRouterKey,
    isCrypto,
    offerVertical,
    jurisdiction,
    locale,
  } = opts

  const channelRule = getChannelCaptionRule(provider)
  let channelCaption = activeCaption

  if (channelRule.targetLocale !== captionSourceLocale && channelRule.targetLocale !== 'source') {
    const translateResult = await translateCaption({
      source: activeCaption,
      targetLocale: channelRule.targetLocale,
      charCap: channelRule.charCap,
      byokKey: byokOpenRouterKey,
    })

    if (translateResult.warning) {
      logger.warn(`[bundle-publisher] ${provider}: ${translateResult.warning}`)
    }
    channelCaption = translateResult.caption
  } else {
    // Same locale — just enforce char cap, skip LLM call
    channelCaption = channelRule.charCap > 0 && activeCaption.length > channelRule.charCap
      ? activeCaption.slice(0, channelRule.charCap - 1) + '…'
      : activeCaption
  }

  // Inject crypto disclaimer into caption for allowed channels
  let finalCaption = channelCaption
  if (isCrypto) {
    const injectionResult = await injectCryptoDisclaimer({
      caption: channelCaption,
      vertical: offerVertical ?? 'crypto',
      targetJurisdiction: jurisdiction,
      channelId: provider,
      locale,
    })

    if (injectionResult.blocked) {
      return {
        blocked: true,
        blockReason: injectionResult.blockReason ?? 'crypto_blocked',
      }
    }

    finalCaption = injectionResult.caption
  }

  return {
    caption: finalCaption,
    blocked: false,
  }
}
