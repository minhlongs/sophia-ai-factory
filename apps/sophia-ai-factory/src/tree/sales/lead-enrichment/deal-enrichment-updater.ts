/**
 * Enterprise Deal BANT Score Recalculation & Enrichment Persistence
 *
 * @module tree/sales/lead-enrichment/deal-enrichment-updater
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  getEnterpriseDealById,
  updateEnterpriseDeal,
} from '../enterprise-deal-repo';
import { calculateBantScore } from '../bant-scoring-service';

/**
 * Updates an enterprise deal record with enriched data and recalculates BANT qualification score.
 */
export async function updateDealEnrichmentData(
  db: D1Database,
  dealId: string,
  enrichment: {
    id: string;
    companyName: string;
    estimatedAnnualRevenue: string;
    industry: string;
    employeeCountRange: string;
  },
): Promise<void> {
  try {
    const deal = await getEnterpriseDealById(db, dealId);
    if (!deal) return;

    const recalculatedBant = calculateBantScore({
      statedBudgetArr: deal.dealValueEstimateCents > 0 ? deal.dealValueEstimateCents / 100 : undefined,
      statedMonthlyMcu: deal.requestedMcuMonthly > 0 ? deal.requestedMcuMonthly : undefined,
      companyRevenueRange: enrichment.estimatedAnnualRevenue,
      jobTitle: deal.leadTitle || undefined,
      leadEmail: deal.leadEmail,
      statedBottleneckOrPainPoint: deal.notes || undefined,
    });

    await updateEnterpriseDeal(db, dealId, {
      companyName: deal.companyName === deal.companyDomain ? enrichment.companyName : deal.companyName,
      pipelineTier: recalculatedBant.pipelineTier,
      dealStage: deal.dealStage === 'enriching' ? 'qualified' : deal.dealStage,
      metadata: {
        ...deal.metadata,
        enrichedAt: Date.now(),
        enrichmentId: enrichment.id,
        industry: enrichment.industry,
        employeeCountRange: enrichment.employeeCountRange,
        estimatedAnnualRevenue: enrichment.estimatedAnnualRevenue,
      },
    });
  } catch (err) {
    logger.warn('[lead-enrichment] Failed to update deal after enrichment', {
      dealId,
      error: String(err),
    });
  }
}
