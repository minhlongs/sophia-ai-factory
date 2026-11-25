/**
 * Closed-Loop Click Feedback Injector (Harness Learning Layer).
 *
 * Reads verified `/api/r/[code]` click data (`verifiedClicks > 0`) and formats
 * the top-performing CTA/Hook signals into a concise prompt context block so
 * subsequent campaign generations learn from real audience clicks at $0 extra cost.
 *
 * @module tree/harness/click-feedback-injector
 */

import type { PilotAffiliateLinkSummary } from '@/seed/pilot/pilot-access-policy';

export function buildClickFeedbackPromptContext(
  links: readonly PilotAffiliateLinkSummary[],
  maxSignals = 3,
): string {
  const winners = [...links]
    .filter((link) => link.verifiedClicks > 0 && link.ctaText.trim().length > 0)
    .sort((a, b) => b.verifiedClicks - a.verifiedClicks)
    .slice(0, Math.max(1, maxSignals));

  if (winners.length === 0) return '';

  const lines = winners.map(
    (item, idx) =>
      `${idx + 1}. "${item.ctaText.trim()}" (${item.verifiedClicks} verified clicks, network: ${item.networkHint})`,
  );

  return [
    'Winning Historical Signals (Server-Verified Clicks — prioritize similar high-intent framing):',
    ...lines,
  ].join('\n');
}
