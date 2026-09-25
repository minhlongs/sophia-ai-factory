/**
 * Pure Domain Contracts and Schemas: Enterprise Deals & B2B Lead Enrichment
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module seed/types/enterprise-deal
 */

import { z } from 'zod';

// ── Deal Enums & Constants ───────────────────────────────────────────────────

export const DEAL_SOURCES = [
  'website',
  'inbound_form',
  'telegram',
  'outbound',
  'referral',
  'event',
  'partner',
] as const;
export type DealSource = (typeof DEAL_SOURCES)[number];

export const DEAL_STAGES = [
  'new_lead',
  'enriching',
  'qualified',
  'demo_prepared',
  'demo_active',
  'proposal_sent',
  'negotiating',
  'closed_won',
  'closed_lost',
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const PIPELINE_TIERS = ['hot', 'warm', 'cold'] as const;
export type PipelineTier = (typeof PIPELINE_TIERS)[number];

export const DEAL_CURRENCIES = ['USD', 'VND', 'EUR', 'JPY', 'SGD'] as const;
export type DealCurrency = (typeof DEAL_CURRENCIES)[number];

export const ASSIGNED_AGENT_ROLES = [
  'ai_sales_executive',
  'human_executive',
  'unassigned',
] as const;
export type AssignedAgentRole = (typeof ASSIGNED_AGENT_ROLES)[number];

export const SANDBOX_STATUSES = [
  'none',
  'provisioning',
  'active',
  'expired',
  'converted',
] as const;
export type SandboxStatus = (typeof SANDBOX_STATUSES)[number];

export const ENRICHMENT_SOURCES = [
  'clearbit',
  'hunter',
  'apollo',
  'ai_web_search',
  'heuristic',
  'manual',
] as const;
export type EnrichmentSource = (typeof ENRICHMENT_SOURCES)[number];

export const ENRICHMENT_STATUSES = [
  'pending',
  'completed',
  'failed',
  'stale',
] as const;
export type EnrichmentStatus = (typeof ENRICHMENT_STATUSES)[number];

export const PROPOSAL_LANGUAGES = ['en', 'vi'] as const;
export type ProposalLanguage = (typeof PROPOSAL_LANGUAGES)[number];

// ── BANT Scoring Types ───────────────────────────────────────────────────────

export interface BantFactorBreakdown {
  score: number;
  maxScore: number;
  factor: 'budget' | 'authority' | 'need' | 'timeline';
  reason: string;
  details: Record<string, unknown>;
}

export interface BantAnalysis {
  budget: BantFactorBreakdown;
  authority: BantFactorBreakdown;
  need: BantFactorBreakdown;
  timeline: BantFactorBreakdown;
  totalScore: number;
  tier: PipelineTier;
  recommendation: string;
  qualifiedAt: number;
}

export interface BantScoreInput {
  // Budget
  statedBudgetArr?: number; // annual USD (e.g. 50000 = $50k)
  statedMonthlyMcu?: number; // requested MCUs
  companyRevenueRange?: string; // e.g. ">$50M", "$10M-$50M", "$1M-$10M", "<$1M"
  
  // Authority
  jobTitle?: string;
  isCorporateEmail?: boolean;
  leadEmail?: string;
  
  // Need
  needsHighVolumeSyndication?: boolean;
  needsApacDubbing?: boolean;
  needsDedicatedGpuLane?: boolean;
  needsCustomApiOrWhiteLabel?: boolean;
  statedBottleneckOrPainPoint?: string;
  needTags?: string[];
  
  // Timeline
  timeframe?:
    | 'immediate'
    | '1_to_3_months'
    | '3_to_6_months'
    | '6_to_12_months'
    | 'exploring'
    | string;
}

export interface BantScoreResult {
  totalScore: number;
  budgetScore: number;
  authorityScore: number;
  needScore: number;
  timelineScore: number;
  pipelineTier: PipelineTier;
  analysis: BantAnalysis;
}

// ── Deal & Enrichment Interfaces ─────────────────────────────────────────────

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

// ── Meeting Prep & Proposal Types ────────────────────────────────────────────

export interface BattlecardItem {
  competitorOrObjection: string;
  ourDifferentiator: string;
  talkingPoint: string;
}

export interface MeetingPrepDossier {
  dealId: string;
  companyOverview: string;
  keyStakeholders: string;
  painPointAnalysis: string;
  proposedSolutionBlueprint: string;
  commercialRecommendation: string;
  battlecards: BattlecardItem[];
  fullBriefMarkdown: string;
  generatedAt: number;
}

export interface ProposalSection {
  title: string;
  content: string;
}

export interface EnterpriseProposalResult {
  proposalId: string;
  dealId: string;
  language: ProposalLanguage;
  title: string;
  sections: ProposalSection[];
  fullMarkdown: string;
  wordCount: number;
  qualityPassed: boolean;
  generatedAt: number;
}

// ── Sandbox Provisioning Types ───────────────────────────────────────────────

export interface SandboxProvisionResult {
  dealId: string;
  subaccountId: string;
  subaccountName: string;
  slug: string;
  allocatedMcu: number;
  expiresAt: number;
  sandboxToken: string;
  demoMagicUrl: string;
  watermarkEnabled: boolean;
}

// ── D1 Row Interfaces ────────────────────────────────────────────────────────

export interface EnterpriseDealRow {
  id: string;
  lead_name: string;
  lead_email: string;
  lead_phone: string | null;
  lead_title: string | null;
  company_name: string;
  company_domain: string;
  lead_source: string;
  deal_stage: string;
  pipeline_tier: string;
  deal_value_estimate_cents: number;
  currency: string;
  requested_mcu_monthly: number;
  bant_score: number;
  bant_budget_score: number;
  bant_authority_score: number;
  bant_need_score: number;
  bant_timeline_score: number;
  bant_analysis_json: string;
  assigned_agent_id: string | null;
  assigned_agent_role: string;
  meeting_prep_brief: string | null;
  proposal_id: string | null;
  proposal_language: string;
  proposal_content: string | null;
  sandbox_subaccount_id: string | null;
  sandbox_status: string;
  sandbox_token: string | null;
  sandbox_expires_at: number | null;
  notes: string | null;
  metadata_json: string;
  created_at: number;
  updated_at: number;
}

export interface EnterpriseLeadEnrichmentRow {
  id: string;
  deal_id: string | null;
  domain: string;
  company_name: string | null;
  industry: string | null;
  employee_count_range: string | null;
  estimated_annual_revenue: string | null;
  headquarters_location: string | null;
  country: string | null;
  tech_stack_json: string;
  linkedin_company_url: string | null;
  twitter_handle: string | null;
  enrichment_source: string;
  confidence_score: number;
  raw_payload_json: string;
  status: string;
  created_at: number;
  updated_at: number;
}

// ── Row Mappers ──────────────────────────────────────────────────────────────

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

// ── Zod Schemas for Validation ───────────────────────────────────────────────

export const CreateEnterpriseDealSchema = z.object({
  leadName: z.string().min(1, 'Lead name is required').max(200),
  leadEmail: z.string().email('Invalid email address'),
  leadPhone: z.string().max(50).optional().nullable(),
  leadTitle: z.string().max(100).optional().nullable(),
  companyName: z.string().min(1, 'Company name is required').max(200),
  companyDomain: z.string().min(1, 'Domain is required').max(255),
  leadSource: z.enum(DEAL_SOURCES).optional().default('website'),
  dealStage: z.enum(DEAL_STAGES).optional().default('new_lead'),
  dealValueEstimateCents: z.number().int().nonnegative().optional().default(0),
  currency: z.enum(DEAL_CURRENCIES).optional().default('USD'),
  requestedMcuMonthly: z.number().int().nonnegative().optional().default(0),
  notes: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  bantInput: z.custom<BantScoreInput>().optional(),
});

export type CreateEnterpriseDealInput = z.input<typeof CreateEnterpriseDealSchema>;

export const UpdateEnterpriseDealSchema = z.object({
  leadName: z.string().min(1).max(200).optional(),
  leadEmail: z.string().email().optional(),
  leadPhone: z.string().max(50).optional().nullable(),
  leadTitle: z.string().max(100).optional().nullable(),
  companyName: z.string().min(1).max(200).optional(),
  companyDomain: z.string().min(1).max(255).optional(),
  leadSource: z.enum(DEAL_SOURCES).optional(),
  dealStage: z.enum(DEAL_STAGES).optional(),
  pipelineTier: z.enum(PIPELINE_TIERS).optional(),
  dealValueEstimateCents: z.number().int().nonnegative().optional(),
  currency: z.enum(DEAL_CURRENCIES).optional(),
  requestedMcuMonthly: z.number().int().nonnegative().optional(),
  assignedAgentId: z.string().optional().nullable(),
  assignedAgentRole: z.enum(ASSIGNED_AGENT_ROLES).optional(),
  meetingPrepBrief: z.string().optional().nullable(),
  proposalId: z.string().optional().nullable(),
  proposalLanguage: z.enum(PROPOSAL_LANGUAGES).optional(),
  proposalContent: z.string().optional().nullable(),
  sandboxSubaccountId: z.string().optional().nullable(),
  sandboxStatus: z.enum(SANDBOX_STATUSES).optional(),
  sandboxToken: z.string().optional().nullable(),
  sandboxExpiresAt: z.number().int().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateEnterpriseDealInput = z.infer<typeof UpdateEnterpriseDealSchema>;

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
