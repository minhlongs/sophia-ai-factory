/**
 * Lead Scoring and Payload Parser
 * Layer: land/telegram-sales
 */

import type { BudgetTier } from '@/seed/types/telegram-sales';
import type { ParsedStartPayload } from './types';

/**
 * Calculates lead qualification score (0-100).
 */
export function calculateLeadScore(
  startPayload?: string | null,
  niche?: string | null,
  budgetTier?: BudgetTier | string | null,
): number {
  let score = 0;

  // 1. Deep-link attribution (+20 points)
  if (
    startPayload &&
    (startPayload.startsWith('vid_') ||
      startPayload.startsWith('ref_') ||
      startPayload.startsWith('demo_') ||
      startPayload.toLowerCase().includes('solo100'))
  ) {
    score += 20;
  }

  // 2. Niche alignment (+15 to +30 points)
  if (niche) {
    const n = niche.toLowerCase();
    if (n === 'ai_agency' || n === 'ai_automation' || n === 'ecommerce' || n === 'solopreneur') {
      score += 30;
    } else if (n === 'real_estate' || n === 'beauty') {
      score += 25;
    } else {
      score += 15;
    }
  }

  // 3. Budget & scale intent (+25 to +50 points)
  if (budgetTier) {
    if (budgetTier === 'high') {
      score += 50;
    } else if (budgetTier === 'mid') {
      score += 40;
    } else if (budgetTier === 'low') {
      score += 25;
    }
  }

  return Math.min(100, score);
}

/**
 * Parses deep-link start payload to extract campaign or referrer.
 */
export function parseStartPayload(payload: string | null): ParsedStartPayload {
  if (!payload) {
    return { campaignId: null, referrerId: null, preferredNiche: null, isSolo100: false };
  }

  const p = payload.trim();
  const isSolo100 = p.toLowerCase().includes('solo100');

  let campaignId: string | null = null;
  let referrerId: string | null = null;
  let preferredNiche: string | null = null;

  if (p.startsWith('vid_')) {
    campaignId = p;

    // Extract embedded referral code if present: vid_<id>_<platform>_ref_<CODE>
    const refMatch = p.match(/_ref_([a-zA-Z0-9_-]+)/);
    if (refMatch) {
      referrerId = refMatch[1];
    }

    // Delimited token matching prevents false positives (e.g. 'chair', 'daily', 'email' containing 'ai')
    if (/(^|_)(ecom|ecommerce)(_|$)/i.test(p)) {
      preferredNiche = 'ecommerce';
    } else if (/(^|_)(agency|ai_automation|ai_agency)(_|$)/i.test(p)) {
      preferredNiche = 'ai_agency';
    } else if (/(^|_)(solo|solopreneur)(_|$)/i.test(p)) {
      preferredNiche = 'solopreneur';
    }
  } else if (p.startsWith('ref_')) {
    referrerId = p.slice(4);
  } else if (p.startsWith('demo_')) {
    preferredNiche = p.slice(5);
  }

  return { campaignId, referrerId, preferredNiche, isSolo100 };
}
