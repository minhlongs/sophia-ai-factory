/**
 * Multi-Tier B2B Lead & Organization Enrichment Service
 *
 * @module tree/sales/lead-enrichment/lead-enrichment-service
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseLeadEnrichment,
  EnrichmentSource,
} from '@/seed/types/enterprise-deal';
import { logger } from '@/seed/utils/logger-utility';
import {
  getLeadEnrichmentByDomain,
  upsertLeadEnrichment,
} from '../enterprise-deal-repo';
import {
  CACHE_TTL_MS,
  type LeadEnrichmentOptions,
  type ResolvedEnrichmentPayload,
} from './types';
import { extractBrandFromDomain, fetchHunterData } from './firmographic-lookup';
import { performAiEnrichment, updateDealEnrichmentData } from './lead-scorer';

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

/**
 * Enriches a lead and its organization domain using the multi-tier hierarchy:
 * 1. D1 Cache
 * 2. BYOK Apollo/Hunter (if configured)
 * 3. AI Heuristic Fallback
 */
export async function enrichLead(
  db: D1Database,
  domain: string,
  options: LeadEnrichmentOptions = {}
): Promise<EnterpriseLeadEnrichment> {
  const cleanDomain = domain.toLowerCase().trim();

  // 1. Check D1 cache unless forceRefresh is true
  if (!options.forceRefresh) {
    const cached = await getLeadEnrichmentByDomain(db, cleanDomain);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
      logger.info('[lead-enrichment] Cache hit in D1', { domain: cleanDomain, id: cached.id });
      if (options.dealId && cached.dealId !== options.dealId) {
        return await upsertLeadEnrichment(db, {
          ...cached,
          dealId: options.dealId,
        });
      }
      return cached;
    }
  }

  const resolved = await resolveEnrichmentPayload(cleanDomain, options);
  const linkedinCompanyUrl = `https://www.linkedin.com/company/${cleanDomain.split('.')[0]}`;
  const twitterHandle = `@${cleanDomain.split('.')[0]}`;

  // Persist enrichment in D1
  const persisted = await upsertLeadEnrichment(db, {
    dealId: options.dealId || null,
    domain: cleanDomain,
    companyName: resolved.companyName,
    industry: resolved.industry,
    employeeCountRange: resolved.employeeCountRange,
    estimatedAnnualRevenue: resolved.estimatedAnnualRevenue,
    headquartersLocation: resolved.headquartersLocation,
    country: resolved.country,
    techStack: resolved.techStack,
    linkedinCompanyUrl,
    twitterHandle,
    enrichmentSource: resolved.source,
    confidenceScore: resolved.confidenceScore,
    rawPayload: resolved.rawPayload,
    status: 'completed',
  });

  // If tied to a deal, update the deal record with newly enriched data and recalculate BANT score
  if (options.dealId) {
    await updateDealEnrichmentData(db, options.dealId, {
      id: persisted.id,
      companyName: resolved.companyName,
      estimatedAnnualRevenue: resolved.estimatedAnnualRevenue,
      industry: resolved.industry,
      employeeCountRange: resolved.employeeCountRange,
    });
  }

  return persisted;
}
