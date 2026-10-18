/**
 * Guideline Generator Templates & Platform Helpers
 *
 * Layer: forest/patterns
 */

import type { PlaybookPattern } from '@/seed/types/playbook-pattern';

/** Platform → goal mapping used when a pattern has no explicit goal. */
export const DEFAULT_GOAL: Record<string, string> = {
  tiktok: 'awareness',
  youtube: 'conversion',
  instagram: 'awareness',
  facebook: 'conversion',
  twitter: 'awareness',
  linkedin: 'conversion',
  reddit: 'awareness',
};

/** Derive a platform name from the feature key/value (channel patterns carry it directly). */
export function platformFromFeature(p: PlaybookPattern): string {
  if (p.featureKey === 'channel') return p.featureValue;
  if (p.featureKey === 'posting_time_bucket') return 'youtube';
  return 'youtube';
}

/** Vietnamese template fallback — used when no LLM is configured. */
export function templateRuleVi(p: PlaybookPattern, platform: string, goal: string): string {
  return `Dùng ${p.featureKey}="${p.featureValue}" cho ${platform} để tối ưu ${goal} — trung bình ${p.metric}=${p.avgMetric} trên ${p.sampleSize} mẫu.`;
}

/** English template fallback — used when no LLM is configured. */
export function templateRuleEn(p: PlaybookPattern, platform: string, goal: string): string {
  return `Use ${p.featureKey}="${p.featureValue}" on ${platform} to optimize ${goal} — avg ${p.metric}=${p.avgMetric} across ${p.sampleSize} samples.`;
}

export async function resolveRuleBilingualText(
  pattern: PlaybookPattern,
  platform: string,
  goal: string,
  prompt: string,
  llm?: (prompt: string) => Promise<string | null>,
): Promise<{ ruleVi: string; ruleEn: string }> {
  let ruleVi = templateRuleVi(pattern, platform, goal);
  let ruleEn = templateRuleEn(pattern, platform, goal);

  if (llm) {
    let raw: string | null = null;
    try {
      raw = await llm(prompt);
    } catch {
      // LLM threw — keep template fallback, do not propagate
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { rule_vi?: string; rule_en?: string };
        if (parsed.rule_vi) ruleVi = parsed.rule_vi;
        if (parsed.rule_en) ruleEn = parsed.rule_en;
      } catch {
        // LLM returned non-JSON — keep template fallback, do not throw
      }
    }
  }

  return { ruleVi, ruleEn };
}
