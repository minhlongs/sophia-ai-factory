/**
 * Creator Marketplace Template Activation Mutator
 *
 * Layer: tree/marketplace
 *
 * @module tree/marketplace/service/template-activate
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CreatorTemplate, RoyaltyAccrualResult } from '../types';
import { accrueRoyalty } from '../royalty-engine';

/**
 * Activates a creator template with 70/30 royalty smart ledger disbursement.
 */
export async function activateMarketplaceTemplate(
  db: D1Database,
  input: {
    templateId: string;
    activatingUserId: string;
    tenantId: string;
    videoJobId?: string;
    nowMs?: number;
  },
): Promise<{
  success: boolean;
  activationResult: RoyaltyAccrualResult;
  template: CreatorTemplate;
}> {
  const nowMs = input.nowMs ?? Date.now();

  // 1. Fetch template
  const template = await db
    .prepare('SELECT * FROM creator_templates WHERE id = ? LIMIT 1')
    .bind(input.templateId)
    .first<CreatorTemplate>();

  if (!template) {
    throw new Error(`TEMPLATE_NOT_FOUND: Template '${input.templateId}' does not exist.`);
  }

  if (template.status !== 'approved') {
    throw new Error(`TEMPLATE_NOT_ACTIVE: Template status is '${template.status}', must be 'approved'.`);
  }

  // 2. Accrue royalty (enforces anti-self-activation & 70/30 OCC CAS ledger)
  const activationResult = await accrueRoyalty({
    db,
    templateId: template.id,
    creatorId: template.creator_id,
    activatingUserId: input.activatingUserId,
    tenantId: input.tenantId,
    priceCents: template.price_cents,
    royaltyPct: template.royalty_pct,
    videoJobId: input.videoJobId,
    nowMs,
  });

  // 3. Increment template usage
  try {
    await db
      .prepare('UPDATE creator_templates SET use_count = use_count + 1, updated_at = ? WHERE id = ?')
      .bind(nowMs, template.id)
      .run();
  } catch (err) {
    logger.warn('[marketplace-service] Failed to update template use_count', { error: String(err) });
  }

  return {
    success: true,
    activationResult,
    template: {
      ...template,
      use_count: template.use_count + 1,
    },
  };
}
