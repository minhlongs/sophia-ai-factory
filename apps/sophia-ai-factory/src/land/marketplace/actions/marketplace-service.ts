'use server';

/**
 * Marketplace Service Server Actions: Query & Read Operations
 *
 * Layer: land
 *
 * @module land/marketplace/actions/marketplace-service
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  TemplateQueryFilter,
  PaginatedTemplates,
  CreatorTemplateItem,
  CreatorReview,
} from '@/tree/marketplace/types';
import {
  listMarketplaceTemplates,
  getMarketplaceTemplateById,
} from '@/tree/marketplace/marketplace-service';
import { getRequiredD1, type ActionResult } from './types';

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
