/**
 * Multi-Tier B2B Lead Enrichment Payload Resolver
 *
 * @module tree/sales/lead-enrichment/enrichment-payload-resolver
 */

import type { EnrichmentSource } from '@/seed/types/enterprise-deal';
import type {
  LeadEnrichmentOptions,
  ResolvedEnrichmentPayload,
} from './types';
import { extractBrandFromDomain, fetchHunterData } from './firmographic-lookup';
import { performAiEnrichment } from './lead-scorer';

export async function resolveEnrichmentPayload(
  cleanDomain: string,
  options: LeadEnrichmentOptions,
): Promise<ResolvedEnrichmentPayload> {
  let source: EnrichmentSource = 'heuristic';
  let companyName = extractBrandFromDomain(cleanDomain);
  let industry = 'Technology & Software';
  let employeeCountRange = '50-250';
  let estimatedAnnualRevenue = '$10M-$50M';
  let headquartersLocation = 'Singapore';
  let country = 'SG';
  let techStack = ['Next.js', 'Cloudflare', 'Tailwind CSS'];
  let confidenceScore = 0.8;
  let rawPayload: Record<string, unknown> = {};

  if (options.hunterApiKey) {
    const hunter = await fetchHunterData(cleanDomain, options.hunterApiKey);
    if (hunter) {
      companyName = hunter.companyName;
      country = hunter.country || country;
      source = 'hunter';
      confidenceScore = 0.95;
      rawPayload = hunter.rawPayload;
    }
  }

  if (source !== 'hunter') {
    const aiResult = await performAiEnrichment(cleanDomain, options.openRouterApiKey);
    companyName = aiResult.companyName;
    industry = aiResult.industry;
    employeeCountRange = aiResult.employeeCountRange;
    estimatedAnnualRevenue = aiResult.estimatedAnnualRevenue;
    headquartersLocation = aiResult.headquartersLocation;
    country = aiResult.country;
    techStack = aiResult.techStack;
    confidenceScore = aiResult.confidenceScore;
    rawPayload = aiResult.rawPayload;
    source = 'ai_web_search';
  }

  return {
    source,
    companyName,
    industry,
    employeeCountRange,
    estimatedAnnualRevenue,
    headquartersLocation,
    country,
    techStack,
    confidenceScore,
    rawPayload,
  };
}
