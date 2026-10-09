/**
 * Enterprise Deals & B2B Lead Enrichment Enums and Constants
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module seed/types/enterprise-deal/deal-constants
 */

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
