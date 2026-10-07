/**
 * Niche Video Campaign Service
 *
 * Orchestrates campaign planning, compliance evaluation, storyboard generation,
 * and affiliate link injection across SaaS & Crypto Global niches.
 * Layer: tree (domain reusable logic)
 * @module tree/video/blueprints/niche-video-service
 */

import { success, failure, type Result } from '@/seed/types/result';
import { getBlueprintById, type VideoBlueprint } from '@/seed/config/video-blueprints';
import type { VideoNiche } from '@/seed/config/video-blueprints/blueprint-types';
import {
  evaluateJurisdictionCompliance,
  type ComplianceGuardResult,
} from '@/tree/video/compliance/jurisdiction-compliance-guard';
import {
  buildSaasScriptPrompt,
  type ScriptPromptPair,
} from '@/tree/video/prompts/saas-script-prompt-builder';
import { buildCryptoScriptPrompt } from '@/tree/video/prompts/crypto-script-prompt-builder';
import {
  generateStoryboardFromBlueprint,
  type StoryboardPlan,
} from '@/tree/video/prompts/storyboard-generator';
import {
  buildNetworkTrackedUrl,
  formatComplianceCaption,
} from '@/tree/affiliates/subid-tracker';
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
  storyboard: StoryboardPlan;
  prompts: ScriptPromptPair;
  trackedUrl: string;
  caption: string;
  overlaySpec?: CryptoOverlaySpec;
  createdAt: string;
}

export interface NicheVideoError {
  code: string;
  message: string;
}

export function createNicheVideoCampaignPlan(
  input: CreateNicheVideoCampaignInput,
): Result<NicheVideoCampaignPlan, NicheVideoError> {
  const {
    niche,
    blueprintId,
    productName,
    productUrl,
    targetAudience,
    jurisdiction = 'GLOBAL',
    affiliateCode = 'sophia_partner',
    subId,
    vanityCoupon,
    locale = 'en',
  } = input;

  const compliance = evaluateJurisdictionCompliance(niche, jurisdiction);
  if (!compliance.isAllowed) {
    return failure({
      code: compliance.reason ?? 'JURISDICTION_BLOCKED',
      message: `Campaign rejected: ${compliance.regulatoryRef ?? 'Jurisdiction blocked by compliance law'}`,
    });
  }

  const blueprint = getBlueprintById(blueprintId);
  if (!blueprint) {
    return failure({
      code: 'BLUEPRINT_NOT_FOUND',
      message: `No registered video blueprint matches ID "${blueprintId}"`,
    });
  }

  const planId = `nvp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const storyboard = generateStoryboardFromBlueprint(blueprint);

  let prompts: ScriptPromptPair;
  if (niche === 'crypto_global') {
    prompts = buildCryptoScriptPrompt({
      exchangeName: productName,
      targetAudience,
      referralCode: affiliateCode,
      vanityCoupon,
      blueprint,
      locale,
    });
  } else {
    prompts = buildSaasScriptPrompt({
      productName,
      targetAudience,
      blueprint,
      vanityCoupon,
      locale,
    });
  }

  const trackedUrl = buildNetworkTrackedUrl({
    targetUrl: productUrl,
    affiliateCode,
    subId,
    vanityCoupon,
  });

  const isCrypto = niche === 'crypto_global';
  const caption = formatComplianceCaption(
    productName,
    trackedUrl,
    vanityCoupon,
    isCrypto,
    locale,
  );

  let overlaySpec: CryptoOverlaySpec | undefined;
  if (isCrypto) {
    overlaySpec = buildCryptoOverlaySpec(
      jurisdiction,
      blueprint.defaultDurationSec,
      locale,
    );
  }

  return success({
    planId,
    productName,
    blueprint,
    compliance,
    storyboard,
    prompts,
    trackedUrl,
    caption,
    overlaySpec,
    createdAt: new Date().toISOString(),
  });
}
