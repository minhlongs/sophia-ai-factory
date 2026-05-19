/**
 * crypto-caption-injector.ts — Prepend jurisdiction-correct crypto disclaimer to captions
 *
 * Called by caption-adapter when offer.vertical === 'crypto'.
 * Disclaimer text is MANDATORY — no user opt-out.
 *
 * Short disclaimer is used here (fits character-limited platforms).
 * Twitter/X char-limit note: full disclaimer exceeds 280 chars;
 * short version is pre-approved by legal counsel for char-limited channels.
 *
 * @module lib/publishing/crypto-caption-injector
 */

import {
  getDisclaimerForJurisdiction,
  isCryptoBlockedInJurisdiction,
} from '@/seed/config/crypto-disclaimer-registry';
import { isChannelBannedForCrypto } from '@/seed/config/crypto-banned-channels';
import { logger } from '@/seed/utils/logger-utility';
import { createDisclaimerHash } from './crypto-disclaimer-audit';

export interface CaptionInjectionInput {
  caption: string;
  /** Offer vertical — only 'crypto' triggers this injector. */
  vertical: string;
  /** Jurisdiction code of the TARGET audience (e.g. channel's primary region). */
  targetJurisdiction: string;
  /** Channel/platform ID (e.g. 'tiktok', 'zalo'). */
  channelId: string;
  /** Locale for disclaimer text ('en' or 'vi'). Default: 'en'. */
  locale?: 'en' | 'vi';
}

export interface CaptionInjectionResult {
  caption: string;
  /** True if disclaimer was injected. False if vertical !== 'crypto'. */
  injected: boolean;
  /** True if crypto content was blocked (VN or banned channel). */
  blocked: boolean;
  /** Reason for block (if blocked). */
  blockReason?: string;
  /** Hash of the disclaimer text used — stored in audit log. */
  disclaimerHash?: string;
  /** Jurisdiction used to select disclaimer. */
  jurisdiction: string;
}

/**
 * Inject mandatory crypto disclaimer into caption if vertical === 'crypto'.
 *
 * Returns original caption unchanged if vertical is not crypto.
 * Throws if channel is banned for this jurisdiction (caller must handle block).
 */
export async function injectCryptoDisclaimer(
  input: CaptionInjectionInput,
): Promise<CaptionInjectionResult> {
  const { caption, vertical, targetJurisdiction, channelId, locale = 'en' } = input;

  if (vertical !== 'crypto') {
    return { caption, injected: false, blocked: false, jurisdiction: targetJurisdiction };
  }

  // Check full jurisdiction block (VN)
  if (isCryptoBlockedInJurisdiction(targetJurisdiction)) {
    const disclaimer = getDisclaimerForJurisdiction(targetJurisdiction);
    const blockReason = disclaimer.regulatoryRef;
    logger.warn('[CryptoCaptionInjector] Blocked: jurisdiction prohibits crypto', {
      jurisdiction: targetJurisdiction,
      channelId,
      regulatoryRef: blockReason,
    });
    return {
      caption,
      injected: false,
      blocked: true,
      blockReason: `Crypto promotion is prohibited in jurisdiction: ${targetJurisdiction}. ${blockReason}`,
      jurisdiction: targetJurisdiction,
    };
  }

  // Check channel-level ban (e.g. Zalo always banned for crypto)
  if (isChannelBannedForCrypto(channelId, targetJurisdiction)) {
    const blockReason = `Channel '${channelId}' is not permitted for crypto affiliate content (VN-audience channel or jurisdiction ban).`;
    logger.warn('[CryptoCaptionInjector] Blocked: channel banned for crypto', {
      channelId,
      jurisdiction: targetJurisdiction,
    });
    return {
      caption,
      injected: false,
      blocked: true,
      blockReason,
      jurisdiction: targetJurisdiction,
    };
  }

  // Inject disclaimer
  const disclaimer = getDisclaimerForJurisdiction(targetJurisdiction);
  const disclaimerText = disclaimer.short[locale];
  const disclaimerHash = await createDisclaimerHash(disclaimerText);

  // Prepend disclaimer to caption (idempotent — check for existing)
  const alreadyInjected = caption.includes(disclaimerText.slice(0, 20));
  const finalCaption = alreadyInjected
    ? caption
    : `${disclaimerText}\n\n${caption}`;

  logger.info('[CryptoCaptionInjector] Disclaimer injected', {
    jurisdiction: targetJurisdiction,
    channelId,
    disclaimerHash,
    locale,
    alreadyInjected,
  });

  return {
    caption: finalCaption,
    injected: !alreadyInjected,
    blocked: false,
    disclaimerHash,
    jurisdiction: targetJurisdiction,
  };
}
