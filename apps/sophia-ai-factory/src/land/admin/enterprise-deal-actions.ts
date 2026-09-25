'use server';

/**
 * Enterprise Deals & B2B AI Sales Agent Server Actions
 *
 * Implements:
 * - Admin RBAC guarded deal management (getCurrentUser + isUserAdminWithRole)
 * - Multi-tier lead enrichment execution
 * - AI meeting prep dossier generation
 * - Bilingual enterprise proposal generation
 * - 1-Click sandboxed demo workspace provisioning
 *
 * Layer: land/admin (Business domain workflows - zero forest imports)
 *
 * @module land/admin/enterprise-deal-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  CreateEnterpriseDealInput,
  UpdateEnterpriseDealInput,
  QueryEnterpriseDealsFilters,
  QueryEnterpriseDealsResult,
  MeetingPrepDossier,
  EnterpriseProposalResult,
  SandboxProvisionResult,
  ProposalLanguage,
} from '@/seed/types/enterprise-deal';
import {
  createEnterpriseDeal,
  getEnterpriseDealById,
  queryEnterpriseDeals,
  updateEnterpriseDeal,
  getDealsPipelineMetrics,
  getLeadEnrichmentByDomain,
} from '@/tree/sales/enterprise-deal-repo';
import { enrichLead } from '@/tree/sales/lead-enrichment-service';
import { generateMeetingPrepDossier } from '@/tree/sales/meeting-prep-service';
import { generateEnterpriseProposal } from '@/tree/sales/enterprise-proposal-service';
import { provisionDemoSandbox } from '@/tree/sales/sandbox-provisioner';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Asserts that the current session belongs to an authorized admin or platform executive.
 */
async function assertAdminSession() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED: Authentication required');
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    throw new Error('FORBIDDEN: Admin privileges required');
  }

  return user;
}

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
 * Triggers multi-tier enrichment for a deal's organization domain.
 */
export async function enrichDealAction(
  dealId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<ActionResult<{ enrichment: EnterpriseLeadEnrichment; deal: EnterpriseDeal }>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const deal = await getEnterpriseDealById(db, dealId);
    if (!deal) return { success: false, error: 'Deal not found' };

    const enrichment = await enrichLead(db, deal.companyDomain, {
      dealId,
      forceRefresh: options.forceRefresh,
    });

    const refreshedDeal = await getEnterpriseDealById(db, dealId);
    return {
      success: true,
      data: {
        enrichment,
        deal: refreshedDeal || deal,
      },
    };
  } catch (err) {
    logger.error('[enterprise-deal-actions] enrichDealAction failed', { dealId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Generates an executive meeting briefing dossier with battlecards.
 */
export async function generateMeetingPrepAction(
  dealId: string
): Promise<ActionResult<MeetingPrepDossier>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const dossier = await generateMeetingPrepDossier(db, dealId);
    return { success: true, data: dossier };
  } catch (err) {
    logger.error('[enterprise-deal-actions] generateMeetingPrepAction failed', { dealId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Generates an executive enterprise solution proposal in English or Vietnamese.
 */
export async function generateProposalAction(
  dealId: string,
  language: ProposalLanguage = 'en'
): Promise<ActionResult<EnterpriseProposalResult>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const proposal = await generateEnterpriseProposal(db, dealId, language);
    return { success: true, data: proposal };
  } catch (err) {
    logger.error('[enterprise-deal-actions] generateProposalAction failed', { dealId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 1-Click provisions an isolated 1,000 MCU sandboxed demo workspace.
 */
export async function provisionSandboxAction(
  dealId: string
): Promise<ActionResult<SandboxProvisionResult>> {
  try {
    await assertAdminSession();
    const db = await getD1();
    if (!db) throw new Error('Database connection unavailable');

    const sandbox = await provisionDemoSandbox(db, dealId);
    return { success: true, data: sandbox };
  } catch (err) {
    logger.error('[enterprise-deal-actions] provisionSandboxAction failed', { dealId, error: String(err) });
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
