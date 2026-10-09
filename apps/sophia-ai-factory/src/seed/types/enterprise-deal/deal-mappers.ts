/**
 * Enterprise Deals & Enrichment Row Mappers and Query Contracts
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module seed/types/enterprise-deal/deal-mappers
 */

import type {
  DealSource,
  DealStage,
  PipelineTier,
  DealCurrency,
  AssignedAgentRole,
  SandboxStatus,
  EnrichmentSource,
  EnrichmentStatus,
  ProposalLanguage,
} from './deal-constants';
import type { BantAnalysis } from './bant-types';
import type {
  EnterpriseDeal,
  EnterpriseLeadEnrichment,
  EnterpriseDealRow,
  EnterpriseLeadEnrichmentRow,
} from './deal-entities';

export function mapDealRowToDeal(row: EnterpriseDealRow): EnterpriseDeal {
  let parsedAnalysis: BantAnalysis;
  try {
    parsedAnalysis = JSON.parse(row.bant_analysis_json || '{}');
  } catch {
    parsedAnalysis = {
      budget: { score: row.bant_budget_score, maxScore: 25, factor: 'budget', reason: 'Default', details: {} },
      authority: { score: row.bant_authority_score, maxScore: 25, factor: 'authority', reason: 'Default', details: {} },
      need: { score: row.bant_need_score, maxScore: 25, factor: 'need', reason: 'Default', details: {} },
      timeline: { score: row.bant_timeline_score, maxScore: 25, factor: 'timeline', reason: 'Default', details: {} },
      totalScore: row.bant_score,
      tier: (row.pipeline_tier as PipelineTier) || 'cold',
      recommendation: '',
      qualifiedAt: row.updated_at,
    };
  }

  let parsedMetadata: Record<string, unknown> = {};
  try {
    parsedMetadata = JSON.parse(row.metadata_json || '{}');
  } catch {
    parsedMetadata = {};
  }

  return {
    id: row.id,
    leadName: row.lead_name,
    leadEmail: row.lead_email,
    leadPhone: row.lead_phone,
    leadTitle: row.lead_title,
    companyName: row.company_name,
    companyDomain: row.company_domain,
    leadSource: (row.lead_source as DealSource) || 'website',
    dealStage: (row.deal_stage as DealStage) || 'new_lead',
    pipelineTier: (row.pipeline_tier as PipelineTier) || 'cold',
    dealValueEstimateCents: Number(row.deal_value_estimate_cents || 0),
    currency: (row.currency as DealCurrency) || 'USD',
    requestedMcuMonthly: Number(row.requested_mcu_monthly || 0),
    bantScore: Number(row.bant_score || 0),
    bantBudgetScore: Number(row.bant_budget_score || 0),
    bantAuthorityScore: Number(row.bant_authority_score || 0),
    bantNeedScore: Number(row.bant_need_score || 0),
    bantTimelineScore: Number(row.bant_timeline_score || 0),
    bantAnalysis: parsedAnalysis,
    assignedAgentId: row.assigned_agent_id,
    assignedAgentRole: (row.assigned_agent_role as AssignedAgentRole) || 'ai_sales_executive',
    meetingPrepBrief: row.meeting_prep_brief,
    proposalId: row.proposal_id,
    proposalLanguage: (row.proposal_language as ProposalLanguage) || 'en',
    proposalContent: row.proposal_content,
    sandboxSubaccountId: row.sandbox_subaccount_id,
    sandboxStatus: (row.sandbox_status as SandboxStatus) || 'none',
    sandboxToken: row.sandbox_token,
    sandboxExpiresAt: row.sandbox_expires_at ? Number(row.sandbox_expires_at) : null,
    notes: row.notes,
    metadata: parsedMetadata,
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

export function mapEnrichmentRowToEnrichment(
  row: EnterpriseLeadEnrichmentRow
): EnterpriseLeadEnrichment {
  let techStack: string[] = [];
  try {
    techStack = JSON.parse(row.tech_stack_json || '[]');
  } catch {
    techStack = [];
  }

  let rawPayload: Record<string, unknown> = {};
  try {
    rawPayload = JSON.parse(row.raw_payload_json || '{}');
  } catch {
    rawPayload = {};
  }

  return {
    id: row.id,
    dealId: row.deal_id,
    domain: row.domain,
    companyName: row.company_name,
    industry: row.industry,
    employeeCountRange: row.employee_count_range,
    estimatedAnnualRevenue: row.estimated_annual_revenue,
    headquartersLocation: row.headquarters_location,
    country: row.country,
    techStack,
    linkedinCompanyUrl: row.linkedin_company_url,
    twitterHandle: row.twitter_handle,
    enrichmentSource: (row.enrichment_source as EnrichmentSource) || 'heuristic',
    confidenceScore: Number(row.confidence_score ?? 1.0),
    rawPayload,
    status: (row.status as EnrichmentStatus) || 'completed',
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

export interface QueryEnterpriseDealsFilters {
  stage?: DealStage;
  pipelineTier?: PipelineTier;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'bant_score' | 'deal_value_estimate_cents';
  orderDirection?: 'asc' | 'desc';
}

export interface QueryEnterpriseDealsResult {
  deals: EnterpriseDeal[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
