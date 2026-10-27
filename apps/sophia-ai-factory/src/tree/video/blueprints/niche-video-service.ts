/**
 * Niche Video Campaign Service
 *
 * Orchestrates campaign planning, compliance evaluation, storyboard generation,
 * and affiliate link injection across SaaS & Crypto Global niches.
 * Layer: tree (domain reusable logic)
 * @module tree/video/blueprints/niche-video-service
 */

import { success, failure, type Result } from '@/seed/types/result';
import { getBlueprintById } from '@/seed/config/video-blueprints';
import { evaluateJurisdictionCompliance } from '@/tree/video/compliance/jurisdiction-compliance-guard';
import { generateStoryboardFromBlueprint } from '@/tree/video/prompts/storyboard-generator';
import {
  buildNetworkTrackedUrl,
  formatComplianceCaption,
} from '@/tree/affiliates/subid-tracker';
import {
  type CreateNicheVideoCampaignInput,
  type NicheVideoCampaignPlan,
  type NicheVideoError,
  buildNichePromptsAndOverlay,
} from './niche-video-types';

export type {
  CreateNicheVideoCampaignInput,
  NicheVideoCampaignPlan,
  NicheVideoError,
};

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
    draftMode = false,
    affiliateCode = 'sophia_partner',
    subId,
    vanityCoupon,
    locale = 'en',
  } = input;

  const compliance = evaluateJurisdictionCompliance(niche, jurisdiction);
  const canStageAsUnassessedDraft =
    draftMode &&
    !compliance.isAllowed &&
    compliance.reason === 'JURISDICTION_UNASSESSED_OR_BLOCKED';

  if (!compliance.isAllowed && !canStageAsUnassessedDraft) {
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

  const { prompts, overlaySpec } = buildNichePromptsAndOverlay({
    niche,
    productName,
    targetAudience,
    affiliateCode,
    vanityCoupon,
    blueprint,
    jurisdiction,
    locale,
  });

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

  return success({
    planId,
    productName,
    blueprint,
    compliance,
    requiresCeoApproval: !compliance.isAllowed || canStageAsUnassessedDraft,
    storyboard,
    prompts,
    trackedUrl,
    caption,
    overlaySpec,
    locale,
    createdAt: new Date().toISOString(),
  });
}
