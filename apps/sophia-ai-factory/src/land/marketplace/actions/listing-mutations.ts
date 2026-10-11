'use server';

/**
 * Marketplace Listing & Review Mutation Server Actions
 *
 * Layer: land
 *
 * @module land/marketplace/actions/listing-mutations
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  CreatorTemplateItem,
  CreateTemplateInput,
  SubmitReviewResult,
} from '@/tree/marketplace/types';
import {
  createMarketplaceTemplate,
  submitTemplateReview,
} from '@/tree/marketplace/marketplace-service';
import { requireAuthUser, getRequiredD1, type ActionResult } from './types';

/**
 * Submits a new creator video blueprint for AI virality scoring and listing.
 */
export async function submitTemplate(
  input: Omit<CreateTemplateInput, 'creatorId' | 'tenantId'> & {
    creatorId?: string;
    tenantId?: string;
  },
): Promise<ActionResult<{ template: CreatorTemplateItem; status: string; feedback: string[] }>> {
  try {
    const user = await requireAuthUser();
    const db = await getRequiredD1();

    const creatorId = input.creatorId || user.id;
    const tenantId =
      input.tenantId ||
      ((user as unknown as { tenantId?: string; orgId?: string }).tenantId ??
        (user as unknown as { tenantId?: string; orgId?: string }).orgId ??
        'default_tenant');

    const result = await createMarketplaceTemplate(db, {
      ...input,
      creatorId,
      tenantId,
    });

    return {
      success: true,
      data: {
        template: result.template,
        status: result.qualityResult.status,
        feedback: result.qualityResult.feedback,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[marketplace-actions] submitTemplate failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Submits a rating and review for a template, updating its average rating incrementally.
 */
export async function submitReview(input: {
  templateId: string;
  rating: number;
  reviewText?: string;
}): Promise<ActionResult<SubmitReviewResult>> {
  try {
    const user = await requireAuthUser();
    const db = await getRequiredD1();

    const tenantId =
      ((user as unknown as { tenantId?: string; orgId?: string }).tenantId ??
        (user as unknown as { tenantId?: string; orgId?: string }).orgId ??
        'default_tenant');

    const result = await submitTemplateReview(db, {
      templateId: input.templateId,
      userId: user.id,
      tenantId,
      rating: input.rating,
      reviewText: input.reviewText,
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[marketplace-actions] submitReview failed', { error: message });
    return { success: false, error: message };
  }
}
