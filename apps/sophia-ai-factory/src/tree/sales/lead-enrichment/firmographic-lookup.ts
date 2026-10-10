/**
 * Firmographic Domain Parsing & External Provider Lookups (Hunter.io)
 *
 * @module tree/sales/lead-enrichment/firmographic-lookup
 */

import { logger } from '@/seed/utils/logger-utility';
import type { HeuristicProfile, HunterEnrichmentResult } from './types';

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
export function inferHeuristicProfile(domain: string): HeuristicProfile {
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
 * Fetches organization data from Hunter.io domain search API.
 */
export async function fetchHunterData(
  cleanDomain: string,
  apiKey: string,
): Promise<HunterEnrichmentResult | null> {
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(cleanDomain)}&api_key=${apiKey}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { organization?: string; country?: string; state?: string } };
    if (data.data?.organization) {
      return {
        companyName: data.data.organization,
        country: data.data.country,
        rawPayload: data,
      };
    }
  } catch (err) {
    logger.warn('[lead-enrichment] Hunter.io API fetch failed, proceeding to next tier', { error: String(err) });
  }
  return null;
}
