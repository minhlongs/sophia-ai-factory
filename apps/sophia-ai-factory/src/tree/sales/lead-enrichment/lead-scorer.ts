/**
 * Semantic AI Enrichment & Enterprise Deal BANT Scoring Pipeline
 *
 * @module tree/sales/lead-enrichment/lead-scorer
 */

import { logger } from '@/seed/utils/logger-utility';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import { extractBrandFromDomain, inferHeuristicProfile } from './firmographic-lookup';
import { updateDealEnrichmentData } from './deal-enrichment-updater';

export { updateDealEnrichmentData };

/**
 * Calls OpenRouter to perform semantic AI enrichment on a company domain.
 */
export async function performAiEnrichment(
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
