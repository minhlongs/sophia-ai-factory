/**
 * OpenRouter Live Generator for Affiliate Campaign Packs.
 *
 * Uses the customer's encrypted BYOK OpenRouter key (`circuitKeyRef: byok:<userId>`),
 * zero platform/Founder fallback, bounded output tokens/timeouts, and strict
 * structure + referral-link + anti-guaranteed-return validation.
 *
 * @module seed/ai/affiliate-campaign-generator
 */

import {
  AFFILIATE_CAMPAIGN_SYSTEM_PROMPT,
  buildAffiliateCampaignUserPrompt,
  normalizeAndValidateCampaignPack,
  type AffiliateCampaignPack,
  type AffiliateOfferBrief,
} from './affiliate-campaign-prompt';
import { rethrowMappedProviderError } from './script-generator-helpers';

export interface GenerateAffiliateCampaignInput {
  readonly offer: AffiliateOfferBrief;
  readonly durationSec: number;
  readonly locale: 'vi' | 'en';
  readonly userId: string;
  readonly apiKey: string;
  readonly model: string;
  readonly maxTokens: number;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly referer?: string;
}

export async function generateAffiliateCampaignPack(
  input: GenerateAffiliateCampaignInput,
): Promise<AffiliateCampaignPack> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error('Customer OpenRouter API key is required');
  }

  const prompt = [
    `System: ${AFFILIATE_CAMPAIGN_SYSTEM_PROMPT}`,
    `User: ${buildAffiliateCampaignUserPrompt(input.offer, input.durationSec, input.locale)}`,
  ].join('\n\n');

  try {
    const { resilientChatCompletion } = await import('@/seed/inference/openrouter-client');
    const rawContent = await resilientChatCompletion(prompt, {
      openRouterKey: apiKey,
      anthropicKey: undefined,
      enableFallback: false,
      model: input.model,
      maxTokens: input.maxTokens,
      maxRetries: input.maxRetries,
      timeoutMs: input.timeoutMs,
      referer: input.referer,
      circuitKeyRef: `byok:${input.userId}`,
    });

    return normalizeAndValidateCampaignPack(rawContent, {
      expectedReferralUrl: input.offer.referralUrl,
      officialWebsiteUrl: input.offer.officialWebsiteUrl,
      vertical: input.offer.vertical,
      targetMarket: input.offer.targetMarket,
      targetDurationSec: input.durationSec,
      locale: input.locale,
    });
  } catch (err) {
    rethrowMappedProviderError(err);
  }
}
