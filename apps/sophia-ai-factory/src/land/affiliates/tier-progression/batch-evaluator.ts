import { logger } from '@/seed/utils/logger-utility';
import type { TierUpgradeEvaluationResult } from '@/seed/types/affiliate-expansion-types';
import { evaluateAndUpgradeTier } from './tier-evaluator';

/**
 * Batch evaluates all active affiliate partners in D1 and applies upgrades.
 */
export async function batchEvaluateAllPartners(
  d1: D1Database
): Promise<TierUpgradeEvaluationResult[]> {
  const partnersStmt = d1.prepare(`
    SELECT id, partner_code
    FROM affiliate_partners
    WHERE status = 'active'
    ORDER BY created_at ASC
  `);
  const { results } = await partnersStmt.all<{ id: string; partner_code: string }>();

  const partners = results ?? [];
  const resultsList: TierUpgradeEvaluationResult[] = [];

  for (const p of partners) {
    try {
      const evaluation = await evaluateAndUpgradeTier(d1, p.id);
      resultsList.push(evaluation);
    } catch (err) {
      logger.error('[tier-progression-engine] Failed evaluating partner in batch', {
        partnerId: p.id,
        error: String(err),
      });
    }
  }

  return resultsList;
}
