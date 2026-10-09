/**
 * Enterprise Deals Creation and Identifier Generation
 *
 * Layer: tree/sales (Pure domain logic - only imports from @/seed)
 *
 * @module tree/sales/deals/deal-create
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseDeal,
  CreateEnterpriseDealInput,
} from '@/seed/types/enterprise-deal';
import { calculateBantScore } from '../bant-scoring-service';
import { getEnterpriseDealById } from './deal-read';

export function generateDealId(prefix = 'deal'): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/**
 * Creates a new enterprise deal in D1.
 * Automatically computes BANT qualification and pipeline tier if bantInput is provided.
 */
export async function createEnterpriseDeal(
  db: D1Database,
  input: CreateEnterpriseDealInput & { id?: string }
): Promise<EnterpriseDeal> {
  const id = input.id || generateDealId('deal');
  const now = Date.now();

  const domain = input.companyDomain.toLowerCase().trim();
  const email = input.leadEmail.toLowerCase().trim();

  const dealValueCents = input.dealValueEstimateCents ?? 0;
  const requestedMcu = input.requestedMcuMonthly ?? 0;

  // Merge provided bantInput with top-level deal fields
  const bantInput = {
    leadEmail: input.bantInput?.leadEmail || email,
    jobTitle: input.bantInput?.jobTitle || input.leadTitle || undefined,
    statedBudgetArr: input.bantInput?.statedBudgetArr ?? (dealValueCents > 0 ? dealValueCents / 100 : undefined),
    statedMonthlyMcu: input.bantInput?.statedMonthlyMcu ?? (requestedMcu > 0 ? requestedMcu : undefined),
    statedBottleneckOrPainPoint: input.bantInput?.statedBottleneckOrPainPoint || input.notes || undefined,
    timeframe: input.bantInput?.timeframe,
    needsHighVolumeSyndication: input.bantInput?.needsHighVolumeSyndication,
    needsApacDubbing: input.bantInput?.needsApacDubbing,
    needsDedicatedGpuLane: input.bantInput?.needsDedicatedGpuLane,
    needsCustomApiOrWhiteLabel: input.bantInput?.needsCustomApiOrWhiteLabel,
    needTags: input.bantInput?.needTags,
    companyRevenueRange: input.bantInput?.companyRevenueRange,
    isCorporateEmail: input.bantInput?.isCorporateEmail,
  };

  const bantResult = calculateBantScore(bantInput);

  const query = `
    INSERT INTO enterprise_deals (
      id, lead_name, lead_email, lead_phone, lead_title,
      company_name, company_domain, lead_source, deal_stage,
      pipeline_tier, deal_value_estimate_cents, currency, requested_mcu_monthly,
      bant_score, bant_budget_score, bant_authority_score, bant_need_score, bant_timeline_score,
      bant_analysis_json, assigned_agent_id, assigned_agent_role, meeting_prep_brief,
      proposal_id, proposal_language, proposal_content,
      sandbox_subaccount_id, sandbox_status, sandbox_token, sandbox_expires_at,
      notes, metadata_json, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `;

  await db
    .prepare(query)
    .bind(
      id,
      input.leadName.trim(),
      email,
      input.leadPhone?.trim() || null,
      input.leadTitle?.trim() || null,
      input.companyName.trim(),
      domain,
      input.leadSource || 'website',
      input.dealStage || 'new_lead',
      bantResult.pipelineTier,
      input.dealValueEstimateCents || 0,
      input.currency || 'USD',
      input.requestedMcuMonthly || 0,
      bantResult.totalScore,
      bantResult.budgetScore,
      bantResult.authorityScore,
      bantResult.needScore,
      bantResult.timelineScore,
      JSON.stringify(bantResult.analysis),
      null, // assigned_agent_id
      'ai_sales_executive',
      null, // meeting_prep_brief
      null, // proposal_id
      'en', // proposal_language
      null, // proposal_content
      null, // sandbox_subaccount_id
      'none', // sandbox_status
      null, // sandbox_token
      null, // sandbox_expires_at
      input.notes?.trim() || null,
      JSON.stringify(input.metadata || {}),
      now,
      now
    )
    .run();

  const created = await getEnterpriseDealById(db, id);
  if (!created) {
    throw new Error(`Failed to retrieve newly created enterprise deal '${id}'`);
  }
  return created;
}
