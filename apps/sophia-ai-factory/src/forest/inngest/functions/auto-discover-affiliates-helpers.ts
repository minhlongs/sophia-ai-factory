/**
 * Helper functions for Auto-Discover Affiliates Inngest job
 */

import {
  scoreAffiliates,
  type AffiliateScore,
} from '@/tree/discovery/affiliate-ai-scorer';
import { createServerClient } from '@/seed/db/client';

export type DiscoveredProgramItem = Parameters<typeof scoreAffiliates>[0][number];

/** Default niches to scan when no user-configured niches exist */
export const DEFAULT_NICHES = [
  'saas productivity workflow',
  'marketing automation',
  'ai tools artificial intelligence',
  'ecommerce online store',
];

export type ScoredAffiliateWithNiche = AffiliateScore & { niche: string };

export function scoreProgramsAcrossNiches(
  programs: DiscoveredProgramItem[],
  niches: string[] = DEFAULT_NICHES,
): ScoredAffiliateWithNiche[] {
  const allScores: ScoredAffiliateWithNiche[] = [];

  for (const niche of niches) {
    const scores = scoreAffiliates(programs, niche);
    const recommended = scores.filter((s) => s.recommended);

    for (const score of recommended) {
      allScores.push({ ...score, niche });
    }
  }

  const bestScores = new Map<string, ScoredAffiliateWithNiche>();

  for (const score of allScores) {
    const existing = bestScores.get(score.programId);
    if (!existing || score.relevanceScore > existing.relevanceScore) {
      bestScores.set(score.programId, score);
    }
  }

  return Array.from(bestScores.values()).sort(
    (a, b) => b.relevanceScore - a.relevanceScore,
  );
}

export async function storeDiscoveredAffiliates(
  programs: DiscoveredProgramItem[],
  scoredResults: ScoredAffiliateWithNiche[],
): Promise<{ count: number; newCount: number }> {
  if (scoredResults.length === 0) {
    return { count: 0, newCount: 0 };
  }

  const db = createServerClient();
  let newDiscoveries = 0;

  const programIds = scoredResults.map((s) => s.programId);
  const { data: existing } = await db
    .from('affiliate_products')
    .select('external_id')
    .in('external_id', programIds);

  type ExistingRow = { external_id: string };
  const existingRows = (existing ?? []) as ExistingRow[];
  const existingIds = new Set(existingRows.map((row) => row.external_id));

  for (const score of scoredResults) {
    if (existingIds.has(score.programId)) continue;

    const matchedProgram = programs.find((p) => p.id === score.programId);
    if (!matchedProgram) continue;

    const { error } = await db.from('affiliate_products').insert({
      external_id: matchedProgram.id,
      network_id: 'clickbank' as const,
      title: matchedProgram.name,
      description: score.reasoning,
      affiliate_link: matchedProgram.link,
      commission_rate: parseFloat(
        matchedProgram.commission.replace(/[^0-9.]/g, '') || '0',
      ),
      avg_earnings_usd: matchedProgram.epc,
      sps_score: score.relevanceScore,
      is_hidden_gem: score.relevanceScore >= 85,
      raw_metrics: {
        cookieDuration: matchedProgram.cookieDuration,
        commissionType: matchedProgram.commissionType,
        niche: score.niche,
        components: score.components,
      },
    });

    if (!error) {
      newDiscoveries++;
    }
  }

  return { count: scoredResults.length, newCount: newDiscoveries };
}

export function buildDiscoveryReportMessage(
  scoredResults: ScoredAffiliateWithNiche[],
  stored: { count: number; newCount: number },
  categoriesCount: number,
): string {
  const topPrograms = scoredResults
    .slice(0, 5)
    .map(
      (s, i) =>
        `${i + 1}. *${s.programName}* (${s.relevanceScore}/100) - ${s.niche}`,
    )
    .join('\n');

  return [
    '🔍 *Sophia Auto-Discovery Report*',
    '',
    `Found *${stored.count}* high-potential affiliates`,
    `New discoveries: *${stored.newCount}*`,
    `Categories scanned: *${categoriesCount}*`,
    '',
    '*Top 5 Programs:*',
    topPrograms || 'No programs scored above threshold',
    '',
    `_${new Date().toISOString().split('T')[0]}_`,
  ].join('\n');
}
