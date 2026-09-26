'use server';

/**
 * Server Actions: Creator Marketplace & Royalty Operations
 *
 * Layer: land (Next.js 15 Server Actions, auth enforcement, database dispatch)
 * Dependencies: @/seed/auth/better-auth-session, @/seed/db/client, @/seed/utils/logger-utility, @/tree/marketplace/*
 *
 * Rules:
 * - NO imports from @/forest
 * - NO :any types
 * - Structured error handling with ActionResult<T>
 *
 * @module land/marketplace/marketplace-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  TemplateQueryFilter,
  PaginatedTemplates,
  CreatorTemplateItem,
  CreatorReview,
  CreateTemplateInput,
  SubmitReviewResult,
  RoyaltyAccrualResult,
  WithdrawalRequestResult,
  CreatorBalanceSummary,
  PayoutRail,
} from '@/tree/marketplace/types';
import {
  listMarketplaceTemplates,
  getMarketplaceTemplateById,
  createMarketplaceTemplate,
  submitTemplateReview,
  activateMarketplaceTemplate,
} from '@/tree/marketplace/marketplace-service';
import {
  processCreatorWithdrawal,
  getCreatorBalance,
} from '@/tree/marketplace/royalty-engine';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Asserts active user session or throws unauthorized error.
 */
async function requireAuthUser() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new Error('UNAUTHORIZED: Please sign in to perform this action.');
  }
  return user;
}

/**
 * Asserts D1 database binding or throws service unavailable error.
 */
async function getRequiredD1() {
  const db = await getD1();
  if (!db) {
    throw new Error('DATABASE_UNAVAILABLE: D1 database binding is unavailable.');
  }
  return db;
}

/**
 * Lists templates from the creator marketplace with filtering and pagination.
 */
export async function listTemplates(
  filters?: TemplateQueryFilter,
): Promise<ActionResult<PaginatedTemplates>> {
  try {
    const db = await getRequiredD1();
    const result = await listMarketplaceTemplates(db, filters);
    return { success: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[marketplace-actions] listTemplates failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Retrieves a single template by ID along with community reviews.
 */
export async function getTemplateById(
  templateId: string,
): Promise<ActionResult<{ template: CreatorTemplateItem | null; reviews: CreatorReview[] }>> {
  try {
    if (!templateId) {
      return { success: false, error: 'templateId is required' };
    }
    const db = await getRequiredD1();
    const result = await getMarketplaceTemplateById(db, templateId);
    if (!result.template) {
      return { success: false, error: 'Template not found' };
    }
    return { success: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[marketplace-actions] getTemplateById failed', { templateId, error: message });
    return { success: false, error: message };
  }
}

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
 * Activates a template, allocating a 70/30 royalty split to the creator via OCC CAS ledger.
 */
export async function activateTemplate(input: {
  templateId: string;
  videoJobId?: string;
}): Promise<ActionResult<{ activationResult: RoyaltyAccrualResult; template: CreatorTemplateItem }>> {
  try {
    const user = await requireAuthUser();
    const db = await getRequiredD1();

    const tenantId =
      ((user as unknown as { tenantId?: string; orgId?: string }).tenantId ??
        (user as unknown as { tenantId?: string; orgId?: string }).orgId ??
        'default_tenant');

    const result = await activateMarketplaceTemplate(db, {
      templateId: input.templateId,
      activatingUserId: user.id,
      tenantId,
      videoJobId: input.videoJobId,
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[marketplace-actions] activateTemplate failed', { error: message });
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

/**
 * Requests a royalty withdrawal via VietQR or USDT rail.
 */
export async function requestWithdrawal(input: {
  amountCents: number;
  rail: PayoutRail;
  destinationAddress?: string;
  bankBin?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  txHash?: string;
}): Promise<ActionResult<WithdrawalRequestResult>> {
  try {
    const user = await requireAuthUser();
    const db = await getRequiredD1();

    const result = await processCreatorWithdrawal({
      db,
      creatorId: user.id,
      amountCents: input.amountCents,
      rail: input.rail,
      destinationAddress: input.destinationAddress,
      bankBin: input.bankBin,
      bankAccountNumber: input.bankAccountNumber,
      bankAccountName: input.bankAccountName,
      txHash: input.txHash,
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[marketplace-actions] requestWithdrawal failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Retrieves the current royalty balance summary for a creator.
 */
export async function getCreatorRoyaltyBalance(
  creatorId?: string,
): Promise<ActionResult<CreatorBalanceSummary>> {
  try {
    const user = await requireAuthUser();
    const targetCreatorId = creatorId || user.id;

    const db = await getRequiredD1();
    const balance = await getCreatorBalance(db, targetCreatorId);

    return {
      success: true,
      data: balance,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[marketplace-actions] getCreatorRoyaltyBalance failed', { error: message });
    return { success: false, error: message };
  }
}

