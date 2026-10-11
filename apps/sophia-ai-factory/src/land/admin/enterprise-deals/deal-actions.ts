'use server';

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ActionResult,
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  CreateEnterpriseDealInput,
  UpdateEnterpriseDealInput,
  QueryEnterpriseDealsFilters,
  QueryEnterpriseDealsResult,
} from './types';
import { assertAdminSession } from './auth';
import {
  createEnterpriseDeal,
  getEnterpriseDealById,
  queryEnterpriseDeals,
  updateEnterpriseDeal,
  getDealsPipelineMetrics,
  getLeadEnrichmentByDomain,
} from '@/tree/sales/enterprise-deal-repo';

/**
 * Queries enterprise deals with filtering and pagination.
 */
export async function queryEnterpriseDealsAction(
  filters: QueryEnterpriseDealsFilters = {}
): Promise<ActionResult<QueryEnterpriseDealsResult>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const result = await queryEnterpriseDeals(db, filters);
    return { success: true, data: result };
  } catch (err) {
    logger.warn('[enterprise-deal-actions] queryEnterpriseDealsAction failed', { error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Retrieves full details for a deal along with organization enrichment data.
 */
export async function getEnterpriseDealAction(
  dealId: string
): Promise<ActionResult<{ deal: EnterpriseDeal; enrichment: EnterpriseLeadEnrichment | null }>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const deal = await getEnterpriseDealById(db, dealId);
    if (!deal) return { success: false, error: 'Deal not found' };

    const enrichment = await getLeadEnrichmentByDomain(db, deal.companyDomain);
    return { success: true, data: { deal, enrichment } };
  } catch (err) {
    logger.warn('[enterprise-deal-actions] getEnterpriseDealAction failed', { dealId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Creates a new enterprise deal and triggers initial qualification.
 */
export async function createEnterpriseDealAction(
  input: CreateEnterpriseDealInput
): Promise<ActionResult<EnterpriseDeal>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const created = await createEnterpriseDeal(db, input);
    return { success: true, data: created };
  } catch (err) {
    logger.error('[enterprise-deal-actions] createEnterpriseDealAction failed', { error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Updates an enterprise deal's stage, tier, or fields.
 */
export async function updateEnterpriseDealAction(
  dealId: string,
  input: UpdateEnterpriseDealInput
): Promise<ActionResult<EnterpriseDeal>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const updated = await updateEnterpriseDeal(db, dealId, input);
    return { success: true, data: updated };
  } catch (err) {
    logger.error('[enterprise-deal-actions] updateEnterpriseDealAction failed', { dealId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Retrieves aggregate enterprise sales pipeline metrics for dashboard cards.
 */
export async function getDealsPipelineMetricsAction(): Promise<
  ActionResult<{
    totalDeals: number;
    hotDeals: number;
    warmDeals: number;
    coldDeals: number;
    totalEstimatedValueCents: number;
    avgBantScore: number;
    wonDeals: number;
  }>
> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const metrics = await getDealsPipelineMetrics(db);
    return { success: true, data: metrics };
  } catch (err) {
    logger.warn('[enterprise-deal-actions] getDealsPipelineMetricsAction failed', { error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
