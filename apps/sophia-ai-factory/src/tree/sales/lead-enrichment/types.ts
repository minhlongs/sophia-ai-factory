/**
 * B2B Lead Enrichment Types & Constants
 *
 * @module tree/sales/lead-enrichment/types
 */

import type { EnrichmentSource } from '@/seed/types/enterprise-deal';

export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface LeadEnrichmentOptions {
  dealId?: string;
  apolloApiKey?: string;
  hunterApiKey?: string;
  openRouterApiKey?: string;
  forceRefresh?: boolean;
}

export interface HeuristicProfile {
  companyName: string;
  industry: string;
  employeeCountRange: string;
  estimatedAnnualRevenue: string;
  techStack: string[];
}

export interface HunterEnrichmentResult {
  companyName: string;
  country?: string;
  rawPayload: Record<string, unknown>;
}

export interface ResolvedEnrichmentPayload {
  source: EnrichmentSource;
  companyName: string;
  industry: string;
  employeeCountRange: string;
  estimatedAnnualRevenue: string;
  headquartersLocation: string;
  country: string;
  techStack: string[];
  confidenceScore: number;
  rawPayload: Record<string, unknown>;
}
