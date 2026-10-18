/**
 * Report formatter for Auto-Discover Affiliates Inngest job.
 * Layer: forest/inngest/functions
 * @module forest/inngest/functions/auto-discover-report-formatter
 */

import type { ScoredAffiliateWithNiche } from './auto-discover-affiliates-helpers';

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
