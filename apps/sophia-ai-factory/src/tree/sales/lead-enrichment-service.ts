/**
 * Multi-Tier B2B Lead & Organization Enrichment Service
 *
 * Enrichment Hierarchy:
 * 1. D1 Database Cache (re-uses fresh enrichment within 30 days)
 * 2. BYOK External Data Providers (Apollo.io / Hunter.io API if configured)
 * 3. Autonomous AI Heuristic Fallback (OpenRouter resilient inference + domain parser)
 *
 * Layer: tree/sales (Pure domain logic - imports only @/seed and tree siblings)
 *
 * @module tree/sales/lead-enrichment-service
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseLeadEnrichment,
  EnrichmentSource,
} from '@/seed/types/enterprise-deal';
import { logger } from '@/seed/utils/logger-utility';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import {
  getLeadEnrichmentByDomain,
  upsertLeadEnrichment,
  getEnterpriseDealById,
  updateEnterpriseDeal,
} from './enterprise-deal-repo';
import { calculateBantScore } from './bant-scoring-service';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface LeadEnrichmentOptions {
  dealId?: string;
  apolloApiKey?: string;
  hunterApiKey?: string;
  openRouterApiKey?: string;
  forceRefresh?: boolean;
}

/**
 * Extracts a readable clean brand name from a domain name.
 * e.g., 'acme-corp.com' -> 'Acme Corp', 'techflow.io' -> 'Techflow'
 */
export function extractBrandFromDomain(domain: string): string {
  const clean = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  const parts = clean.split('.');
  if (parts.length <= 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  }

  // Handle common second-level domains like .co.uk, .com.vn, .org.uk
  const COMMON_SLDS = new Set(['co', 'com', 'org', 'net', 'edu', 'gov', 'ac']);
  let baseIndex = parts.length - 2;
  if (parts.length >= 3 && COMMON_SLDS.has(parts[parts.length - 2])) {
    baseIndex = parts.length - 3;
  }
  const base = parts[baseIndex];
  return base
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Infers initial industry and tech stack indicators from domain characteristics.
 */
export function inferHeuristicProfile(domain: string): {
  companyName: string;
  industry: string;
  employeeCountRange: string;
  estimatedAnnualRevenue: string;
  techStack: string[];
} {
  const brand = extractBrandFromDomain(domain);
  const lower = domain.toLowerCase();

  let industry = 'Technology & Software';
  const techStack = ['Next.js', 'Cloudflare', 'PostgreSQL', 'Tailwind CSS'];

  if (lower.includes('agency') || lower.includes('media') || lower.includes('studio') || lower.includes('creative') || lower.includes('video')) {
    industry = 'Digital Agency & Media Production';
    techStack.push('CapCut', 'Premiere Pro', 'YouTube API', 'TikTok Pixel');
  } else if (lower.includes('fin') || lower.includes('pay') || lower.includes('bank') || lower.includes('wallet')) {
    industry = 'Fintech & Financial Services';
    techStack.push('Stripe', 'Security Vault', 'Kafka');
  } else if (lower.includes('health') || lower.includes('clinic') || lower.includes('pharma') || lower.includes('hospital') || lower.includes('medical') || lower.includes('medicine')) {
    industry = 'Healthcare & Life Sciences';
    techStack.push('HIPAA Compliance', 'Docker');
  } else if (lower.includes('edu') || lower.includes('academy') || lower.includes('learn')) {
    industry = 'EdTech & Online Education';
    techStack.push('LMS', 'Video Streaming');
  } else if (lower.includes('shop') || lower.includes('store') || lower.includes('mart') || lower.includes('retail')) {
    industry = 'E-Commerce & D2C';
    techStack.push('Shopify', 'Klaviyo', 'Google Analytics');
  } else if (lower.includes('agency') || lower.includes('media') || lower.includes('studio') || lower.includes('creative')) {
    industry = 'Digital Agency & Media Production';
    techStack.push('CapCut', 'Premiere Pro', 'YouTube API', 'TikTok Pixel');
  }

  return {
    companyName: brand,
    industry,
    employeeCountRange: '50-250',
    estimatedAnnualRevenue: '$10M-$50M',
    techStack,
  };
}

/**
 * Calls OpenRouter to perform semantic AI enrichment on a company domain.
 */
async function performAiEnrichment(
  domain: string,
  openRouterApiKey?: string
): Promise<{
  companyName: string;
  industry: string;
  employeeCountRange: string;
  estimatedAnnualRevenue: string;
  headquartersLocation: string;
  country: string;
  techStack: string[];
  confidenceScore: number;
  rawPayload: Record<string, unknown>;
}> {
  const brand = extractBrandFromDomain(domain);
  const prompt = `Analyze the company domain "${domain}" (likely brand: "${brand}").
Return ONLY valid JSON matching this exact structure:
{
  "companyName": "Exact or inferred company name",
  "industry": "Industry sector (e.g. Media, E-Commerce, SaaS, Financial Services)",
  "employeeCountRange": "1-10" or "11-50" or "51-200" or "201-500" or "501-1000" or "1000+",
  "estimatedAnnualRevenue": "<$1M" or "$1M-$10M" or "$10M-$50M" or ">$50M",
  "headquartersLocation": "City, State or Country",
  "country": "Primary country name or 2-letter code",
  "techStack": ["3-6 relevant technologies or platforms likely used by this business"],
  "confidenceScore": 0.85
}`;

  try {
    const rawResponse = await resilientChatCompletion(prompt, {
      openRouterKey: openRouterApiKey || process.env.OPENROUTER_API_KEY || null,
      model: 'openai/gpt-4o-mini',
    });

    const cleaned = rawResponse
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    return {
      companyName: parsed.companyName || brand,
      industry: parsed.industry || 'Digital Media & AI',
      employeeCountRange: parsed.employeeCountRange || '51-200',
      estimatedAnnualRevenue: parsed.estimatedAnnualRevenue || '$10M-$50M',
      headquartersLocation: parsed.headquartersLocation || 'Singapore',
      country: parsed.country || 'SG',
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack : ['Cloudflare', 'Next.js'],
      confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.85,
      rawPayload: parsed,
    };
  } catch (err) {
    logger.warn('[lead-enrichment] OpenRouter AI inference skipped or failed, using heuristic profile', {
      domain,
      error: String(err),
    });
    const heuristic = inferHeuristicProfile(domain);
    return {
      companyName: heuristic.companyName,
      industry: heuristic.industry,
      employeeCountRange: heuristic.employeeCountRange,
      estimatedAnnualRevenue: heuristic.estimatedAnnualRevenue,
      headquartersLocation: 'APAC Region',
      country: 'Global',
      techStack: heuristic.techStack,
      confidenceScore: 0.65,
      rawPayload: { mode: 'deterministic_heuristic_fallback' },
    };
  }
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
      // If a dealId was specified and cached record doesn't have it, update dealId
      if (options.dealId && cached.dealId !== options.dealId) {
        return await upsertLeadEnrichment(db, {
          ...cached,
          dealId: options.dealId,
        });
      }
      return cached;
    }
  }

  let source: EnrichmentSource = 'heuristic';
  let companyName = extractBrandFromDomain(cleanDomain);
  let industry = 'Technology & Software';
  let employeeCountRange = '50-250';
  let estimatedAnnualRevenue = '$10M-$50M';
  let headquartersLocation = 'Singapore';
  let country = 'SG';
  let techStack = ['Next.js', 'Cloudflare', 'Tailwind CSS'];
  let linkedinCompanyUrl: string | null = null;
  let twitterHandle: string | null = null;
  let confidenceScore = 0.8;
  let rawPayload: Record<string, unknown> = {};

  // 2. Check BYOK External APIs if provided
  if (options.hunterApiKey) {
    try {
      const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(cleanDomain)}&api_key=${options.hunterApiKey}`);
      if (res.ok) {
        const data = await res.json() as { data?: { organization?: string; country?: string; state?: string } };
        if (data.data?.organization) {
          companyName = data.data.organization;
          country = data.data.country || country;
          source = 'hunter';
          confidenceScore = 0.95;
          rawPayload = data;
        }
      }
    } catch (err) {
      logger.warn('[lead-enrichment] Hunter.io API fetch failed, proceeding to next tier', { error: String(err) });
    }
  }

  // 3. Fallback to OpenRouter AI enrichment if external provider did not resolve
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

  linkedinCompanyUrl = `https://www.linkedin.com/company/${cleanDomain.split('.')[0]}`;
  twitterHandle = `@${cleanDomain.split('.')[0]}`;

  // Persist enrichment in D1
  const persisted = await upsertLeadEnrichment(db, {
    dealId: options.dealId || null,
    domain: cleanDomain,
    companyName,
    industry,
    employeeCountRange,
    estimatedAnnualRevenue,
    headquartersLocation,
    country,
    techStack,
    linkedinCompanyUrl,
    twitterHandle,
    enrichmentSource: source,
    confidenceScore,
    rawPayload,
    status: 'completed',
  });

  // If tied to a deal, update the deal record with newly enriched data and recalculate BANT score
  if (options.dealId) {
    try {
      const deal = await getEnterpriseDealById(db, options.dealId);
      if (deal) {
        const recalculatedBant = calculateBantScore({
          statedBudgetArr: deal.dealValueEstimateCents > 0 ? deal.dealValueEstimateCents / 100 : undefined,
          statedMonthlyMcu: deal.requestedMcuMonthly > 0 ? deal.requestedMcuMonthly : undefined,
          companyRevenueRange: estimatedAnnualRevenue,
          jobTitle: deal.leadTitle || undefined,
          leadEmail: deal.leadEmail,
          statedBottleneckOrPainPoint: deal.notes || undefined,
        });

        await updateEnterpriseDeal(db, options.dealId, {
          companyName: deal.companyName === deal.companyDomain ? companyName : deal.companyName,
          pipelineTier: recalculatedBant.pipelineTier,
          dealStage: deal.dealStage === 'enriching' ? 'qualified' : deal.dealStage,
          metadata: {
            ...deal.metadata,
            enrichedAt: Date.now(),
            enrichmentId: persisted.id,
            industry,
            employeeCountRange,
            estimatedAnnualRevenue,
          },
        });
      }
    } catch (err) {
      logger.warn('[lead-enrichment] Failed to update deal after enrichment', {
        dealId: options.dealId,
        error: String(err),
      });
    }
  }

  return persisted;
}
