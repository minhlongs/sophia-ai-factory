/**
 * Enterprise Deals & Enrichment Entities and D1 Row Interfaces
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * @module seed/types/enterprise-deal/deal-entities
 */

import type {
  DealSource, DealStage, PipelineTier, DealCurrency,
  AssignedAgentRole, SandboxStatus, EnrichmentSource,
  EnrichmentStatus, ProposalLanguage,
} from './deal-constants';
import type { BantAnalysis } from './bant-types';

export interface EnterpriseDeal {
  id: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string | null;
  leadTitle: string | null;
  companyName: string;
  companyDomain: string;
  leadSource: DealSource;
  dealStage: DealStage;
  pipelineTier: PipelineTier;
  dealValueEstimateCents: number;
  currency: DealCurrency;
  requestedMcuMonthly: number;
  bantScore: number;
  bantBudgetScore: number;
  bantAuthorityScore: number;
  bantNeedScore: number;
  bantTimelineScore: number;
  bantAnalysis: BantAnalysis;
  assignedAgentId: string | null;
  assignedAgentRole: AssignedAgentRole;
  meetingPrepBrief: string | null;
  proposalId: string | null;
  proposalLanguage: ProposalLanguage;
  proposalContent: string | null;
  sandboxSubaccountId: string | null;
  sandboxStatus: SandboxStatus;
  sandboxToken: string | null;
  sandboxExpiresAt: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface EnterpriseLeadEnrichment {
  id: string;
  dealId: string | null;
  domain: string;
  companyName: string | null;
  industry: string | null;
  employeeCountRange: string | null;
  estimatedAnnualRevenue: string | null;
  headquartersLocation: string | null;
  country: string | null;
  techStack: string[];
  linkedinCompanyUrl: string | null;
  twitterHandle: string | null;
  enrichmentSource: EnrichmentSource;
  confidenceScore: number;
  rawPayload: Record<string, unknown>;
  status: EnrichmentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface EnterpriseDealRow {
  id: string; lead_name: string; lead_email: string;
  lead_phone: string | null; lead_title: string | null;
  company_name: string; company_domain: string;
  lead_source: string; deal_stage: string; pipeline_tier: string;
  deal_value_estimate_cents: number; currency: string; requested_mcu_monthly: number;
  bant_score: number; bant_budget_score: number; bant_authority_score: number;
  bant_need_score: number; bant_timeline_score: number; bant_analysis_json: string;
  assigned_agent_id: string | null; assigned_agent_role: string;
  meeting_prep_brief: string | null; proposal_id: string | null;
  proposal_language: string; proposal_content: string | null;
  sandbox_subaccount_id: string | null; sandbox_status: string;
  sandbox_token: string | null; sandbox_expires_at: number | null;
  notes: string | null; metadata_json: string;
  created_at: number; updated_at: number;
}

export interface EnterpriseLeadEnrichmentRow {
  id: string; deal_id: string | null; domain: string;
  company_name: string | null; industry: string | null;
  employee_count_range: string | null; estimated_annual_revenue: string | null;
  headquarters_location: string | null; country: string | null;
  tech_stack_json: string; linkedin_company_url: string | null;
  twitter_handle: string | null; enrichment_source: string;
  confidence_score: number; raw_payload_json: string; status: string;
  created_at: number; updated_at: number;
}
