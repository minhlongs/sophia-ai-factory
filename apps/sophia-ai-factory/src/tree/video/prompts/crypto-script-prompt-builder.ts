/**
 * Crypto Script Prompt Builder
 *
 * Generates conversion prompts for Crypto Affiliate with strict regulatory compliance.
 * Layer: tree (domain reusable prompt synthesis)
 * @module tree/video/prompts/crypto-script-prompt-builder
 */

import type { VideoBlueprint } from '@/seed/config/video-blueprints/blueprint-types';
import type { ScriptPromptPair } from './saas-script-prompt-builder';

export interface CryptoScriptPromptInput {
  exchangeName: string;
  targetAudience?: string;
  feeDiscountPct?: number;
  signupBonusUsd?: number;
  referralCode?: string;
  vanityCoupon?: string | null;
  blueprint: VideoBlueprint;
  locale?: 'en' | 'vi';
}

export function buildCryptoScriptPrompt(input: CryptoScriptPromptInput): ScriptPromptPair {
  const {
    exchangeName,
    targetAudience = 'active crypto & futures volume traders',
    // No defaults: a discount or bonus may only be stated when the verified
    // offer actually supplies it. Otherwise the fact is UNKNOWN.
    feeDiscountPct,
    signupBonusUsd,
    referralCode,
    blueprint,
    locale = 'en',
  } = input;

  const codeText = referralCode ? `using referral code "${referralCode}"` : '';
  const offerFacts = [
    feeDiscountPct !== undefined && feeDiscountPct > 0 ? `${feeDiscountPct}% fee discount (from verified offer terms)` : null,
    signupBonusUsd !== undefined && signupBonusUsd > 0 ? `up to $${signupBonusUsd} signup bonus (from verified offer terms)` : null,
  ].filter((part): part is string => part !== null);
  const offerLine = offerFacts.length > 0
    ? `Verified offer facts: ${offerFacts.join(' + ')} ${codeText}.`
    : `Offer facts: UNKNOWN. Do NOT state any discount, bonus, reward, guaranteed return or eligibility claim. Use only the verified partner link ${codeText}.`;

  const systemPrompt = [
    'You are a premier Financial & Crypto Direct-Response Scriptwriter specializing in volume-trader affiliate conversion.',
    'COMPLIANCE IS ABSOLUTE (CFTC 4.41, FTC 16 C.F.R. § 255, EU MiCA Art. 7/53):',
    '- You MUST NEVER promise guaranteed profits or depict crypto trading as risk-free wealth generation.',
    '- Mandatory risk reminder: 70-80% of retail crypto accounts lose capital in derivatives.',
    '- Clear affiliate disclosure: State transparently that creator receives affiliate commissions.',
    '- The FINAL 15 SECONDS (0:45 to 1:00) MUST BE RESERVED for the legal end-card reading and calm risk disclaimer.',
    `- Narration timing: 0:00 to 0:45 is fast-paced (max 100 words), 0:45 to 1:00 is calm legal notice (max 25 words).`,
    `- Output language: ${locale === 'vi' ? 'Vietnamese' : 'English'}.`,
  ].join('\n');

  // Blueprint overlay texts contain TEMPLATE numbers (e.g. "20% BACK"). They
  // are not offer facts. When no verified facts were supplied, omit them so a
  // generated script cannot inherit an unsourced financial claim.
  const sceneDirectives = blueprint.scenes
    .map(
      (s) =>
        offerFacts.length > 0
          ? `- Scene ${s.sceneIndex + 1} (${s.name}, ${s.startSec}s-${s.endSec}s): ${s.pacingDesc}. Overlay text: "${s.overlayText || ''}" (template — only keep numbers present in the verified offer facts above).`
          : `- Scene ${s.sceneIndex + 1} (${s.name}, ${s.startSec}s-${s.endSec}s): ${s.pacingDesc}. Overlay text: use a neutral, non-numeric line; no offer-specific claim is verified.`,
    )
    .join('\n');

  const userPrompt = [
    `Create a 60-second high-converting & compliant video script for "${exchangeName}".`,
    `Niche: Crypto Global (Target: ${targetAudience}).`,
    `Blueprint: ${blueprint.name}.`,
    offerLine,
    '',
    'BLUEPRINT SCENE SEQUENCE:',
    sceneDirectives,
    '',
    'Return your response in clean JSON format with keys:',
    '- hookLine: The exact opening words (neutral, no numeric financial claim).',
    '- scriptNarration: Full narration text scene by scene.',
    '- midRollRiskDisclaimer: The audio sentence spoken around 0:35 regarding risk.',
    '- endCardDisclosureText: The legal disclosure text for the final 15s screen.',
    '- pinnedCommentText: Pinned comment with tracking code and #ad disclosure.',
    '- estimatedDurationSec: 60.',
  ].join('\n');

  return { systemPrompt, userPrompt };
}
