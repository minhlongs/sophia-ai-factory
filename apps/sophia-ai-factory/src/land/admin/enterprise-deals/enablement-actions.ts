'use server';

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ActionResult,
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  MeetingPrepDossier,
  EnterpriseProposalResult,
  SandboxProvisionResult,
  ProposalLanguage,
} from './types';
import { assertAdminSession } from './auth';
import { getEnterpriseDealById } from '@/tree/sales/enterprise-deal-repo';
import { enrichLead } from '@/tree/sales/lead-enrichment-service';
import { generateMeetingPrepDossier } from '@/tree/sales/meeting-prep-service';
import { generateEnterpriseProposal } from '@/tree/sales/enterprise-proposal-service';
import { provisionDemoSandbox } from '@/tree/sales/sandbox-provisioner';

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
