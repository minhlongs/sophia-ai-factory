/**
 * Niche Video Campaign Types & Prompt Resolution Helpers
 *
 * Layer: tree (domain reusable logic)
 * @module tree/video/blueprints/niche-video-types
 */

import type { VideoBlueprint } from '@/seed/config/video-blueprints';
import type { VideoNiche } from '@/seed/config/video-blueprints/blueprint-types';
import type { ComplianceGuardResult } from '@/tree/video/compliance/jurisdiction-compliance-guard';
import {
  buildSaasScriptPrompt,
  type ScriptPromptPair,
} from '@/tree/video/prompts/saas-script-prompt-builder';
import { buildCryptoScriptPrompt } from '@/tree/video/prompts/crypto-script-prompt-builder';
import type { StoryboardPlan } from '@/tree/video/prompts/storyboard-generator';
import {
  buildCryptoOverlaySpec,
  type CryptoOverlaySpec,
} from './crypto-compliance-overlay';

export interface CreateNicheVideoCampaignInput {
  niche: VideoNiche;
  blueprintId: string;
  productName: string;
  productUrl: string;
  targetAudience?: string;
  jurisdiction?: string;
  draftMode?: boolean;
  affiliateCode?: string;
  subId?: string | null;
  vanityCoupon?: string | null;
  locale?: 'en' | 'vi';
}

export interface NicheVideoCampaignPlan {
  planId: string;
  productName: string;
  blueprint: VideoBlueprint;
  compliance: ComplianceGuardResult;
  requiresCeoApproval?: boolean;
  storyboard: StoryboardPlan;
  prompts: ScriptPromptPair;
  trackedUrl: string;
  caption: string;
  overlaySpec?: CryptoOverlaySpec;
  /** Explicit campaign language; never inferred from prompt text downstream. */
  locale?: 'en' | 'vi';
  createdAt: string;
}

export interface NicheVideoError {
  code: string;
  message: string;
}

export function buildNichePromptsAndOverlay(params: {
  niche: VideoNiche;
  productName: string;
  targetAudience?: string;
  affiliateCode: string;
  vanityCoupon?: string | null;
  blueprint: VideoBlueprint;
  jurisdiction: string;
  locale: 'en' | 'vi';
}): { prompts: ScriptPromptPair; overlaySpec?: CryptoOverlaySpec } {
  const {
    niche,
    productName,
    targetAudience,
    affiliateCode,
    vanityCoupon,
    blueprint,
    jurisdiction,
    locale,
  } = params;

  if (niche === 'crypto_global') {
    const prompts = buildCryptoScriptPrompt({
      exchangeName: productName,
      targetAudience,
      referralCode: affiliateCode,
      vanityCoupon,
      blueprint,
      locale,
    });
    const overlaySpec = buildCryptoOverlaySpec(
      jurisdiction,
      blueprint.defaultDurationSec,
      locale,
    );
    return { prompts, overlaySpec };
  }

  const prompts = buildSaasScriptPrompt({
    productName,
    targetAudience,
    blueprint,
    vanityCoupon,
    locale,
  });
  return { prompts };
}
