/**
 * E-Commerce Product Mission Trigger
 *
 * Bridge that automatically creates and configures a creative video generation
 * mission from a UnifiedProductItem.
 *
 * Layer: land (business domain workflow)
 * @module land/commerce/mission-trigger
 */

import { type Result, success, failure } from '@/seed/types/result';
import type {
  UnifiedProductItem,
  ProductVideoGenerationPrompt,
} from '@/seed/types/ecommerce';
import { createMission, type MissionError } from '@/land/creative-mission/actions';
import { buildProductVideoPrompt } from './catalog-mapper';

export interface TriggerProductMissionInput {
  workspaceId: string;
  product: UnifiedProductItem;
  brandId?: string;
  autonomyLevel?: number;
  customChannels?: string[];
  budgetCents?: number;
}

export interface TriggerProductMissionResult {
  missionId: string;
  product: UnifiedProductItem;
  prompt: ProductVideoGenerationPrompt;
}

/**
 * Triggers an autonomous video creative mission for a catalog product.
 */
export async function triggerProductVideoMission(
  input: TriggerProductMissionInput
): Promise<Result<TriggerProductMissionResult, MissionError>> {
  const { workspaceId, product, brandId, autonomyLevel = 1, customChannels, budgetCents = 0 } = input;

  if (!workspaceId) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Workspace ID is required' });
  }

  if (!product.title) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Product title is required' });
  }

  const prompt = buildProductVideoPrompt(product);
  const now = Math.floor(Date.now() / 1000);
  const title = `[Video Ad] ${product.title.slice(0, 150)}`;
  const objective = `${prompt.headlineHook} Selling points: ${prompt.sellingPoints.join('; ')}. CTA: ${prompt.callToAction}`.slice(0, 1900);

  const missionRes = await createMission({
    workspaceId,
    title,
    objective,
    audience: prompt.targetAudience.slice(0, 950),
    geography: 'Global / US / VN',
    timeframeStart: now,
    timeframeEnd: now + 86400 * 7,
    budgetCents,
    autonomyLevel,
    channels: customChannels ?? prompt.suggestedChannels,
    monetizationGoals: ['e-commerce sales', 'dropshipping conversion', 'ugc video ads'],
    constraints: {
      productId: product.id,
      platform: product.platform,
      productUrl: product.url,
      price: product.price,
      currency: product.currency,
      visualAssetUrls: prompt.visualAssetUrls,
      recommendedDurationSeconds: prompt.recommendedDurationSeconds,
    },
    successMetrics: {
      target_ctr: 0.05,
      target_roas: 2.5,
    },
    brandId,
  });

  if (!missionRes.ok) {
    return failure(missionRes.error);
  }

  return success({
    missionId: missionRes.value.missionId,
    product,
    prompt,
  });
}
