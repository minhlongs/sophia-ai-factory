/**
 * Agency Client Onboarding & Admin Portal Types
 *
 * Implements canonical contracts for:
 * - 5-Step Client Onboarding Wizard (Profile, Branding, Domain, Seed Agents, Launch)
 * - Agency Admin Cockpit KPI Overviews, Subaccounts, Campaigns, and MRR Attribution
 * - Seed Agent deployment specifications under AGY governance policies
 *
 * Layer: seed/types (Foundational data contracts - zero imports from upper layers)
 *
 * @module seed/types/agency-portal
 */

import type { AutonomyLevel as AgyAutonomyLevel, EscalationAction } from './agent-governance';

export type AgencyOnboardingStep = 1 | 2 | 3 | 4 | 5;

export interface AgencyProfileInput {
  clientName: string;
  agencySlug: string;
  contactEmail: string;
  industryTag: string;
  initialMcuBudget: number;
}

export interface AgencyBrandingInput {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  customCss?: string;
}

export interface AgencyDomainInput {
  subdomain?: string;
  customDomain?: string;
  cnameTarget?: string;
  isSslReady?: boolean;
}

export type SeedAgentRole = 'video_creator' | 'ugc_reviewer' | 'sales_outreach';

export interface SeedAgentDeploymentConfig {
  agentId: string;
  name: string;
  role: SeedAgentRole;
  template: string;
  maxAutonomy: AgyAutonomyLevel;
  maxComputeUnitsMcu: number;
  escalationPolicy: EscalationAction;
  enabled: boolean;
}

export interface AgencyOnboardingSubmission {
  agencyOrgId: string;
  profile: AgencyProfileInput;
  branding: AgencyBrandingInput;
  domain: AgencyDomainInput;
  seedAgents: SeedAgentDeploymentConfig[];
}

export interface AgencyOnboardingResult {
  success: boolean;
  subaccountId?: string;
  agencySlug?: string;
  portalUrl?: string;
  reviewTokenUrl?: string;
  deployedAgentsCount?: number;
  error?: string;
  stepErrors?: Partial<Record<'profile' | 'branding' | 'domain' | 'seedAgents', string[]>>;
}

export interface AgencyKpiOverview {
  totalActiveClients: number;
  totalAllocatedMcu: number;
  totalUsedMcu: number;
  mcuUtilizationRate: number;
  activeCampaigns: number;
  attributedMrrUsd: number;
  growthRatePercent: number;
}

export interface AgencyClientSummary {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  allocatedMcu: number;
  usedMcu: number;
  mcuUtilizationRate: number;
  customDomain?: string | null;
  portalUrl: string;
  activeCampaignsCount: number;
  createdAt: string;
}

export interface AgencyCampaignSummary {
  id: string;
  subaccountId: string;
  clientName: string;
  title: string;
  status: 'draft' | 'in_review' | 'approved' | 'published';
  rendersCount: number;
  mcuConsumed: number;
  updatedAt: string;
}

export type VelocityAlertStatus = 'normal' | 'near_limit' | 'exceeded';

export interface AgencyRevenueAttribution {
  subaccountId: string;
  clientName: string;
  tier: string;
  mrrUsd: number;
  mcuConsumed: number;
  marginPercent: number;
  velocityStatus: VelocityAlertStatus;
}

export interface AgencyAdminDashboardData {
  kpi: AgencyKpiOverview;
  clients: AgencyClientSummary[];
  campaigns: AgencyCampaignSummary[];
  attribution: AgencyRevenueAttribution[];
  agencyContext: {
    agencyId: string;
    agencyName: string;
    agencySlug: string;
  };
}
