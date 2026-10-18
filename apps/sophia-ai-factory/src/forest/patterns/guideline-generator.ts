/**
 * Guideline Generator — Phase 5: Auto-Creative Playbook (COMPOUND stage)
 *
 * Transforms detected patterns into human-readable rules grouped by
 * platform + goal. Bilingual VN+EN. Each rule carries confidence level
 * and sample size.
 *
 * Layer: forest (infrastructure orchestrator — calls seed prompt builder
 * and land inference via BYOK, never directly).
 */

import { buildPlaybookPrompt } from '@/seed/inference/prompt-builders';
import type { PlaybookPattern, PlaybookRule } from '@/seed/types/playbook-pattern';
import { upsertRule } from './rule-store';
import {
  DEFAULT_GOAL,
  platformFromFeature,
  templateRuleVi,
  templateRuleEn,
  resolveRuleBilingualText,
} from './guideline-templates';
import { buildPlaybookLlm } from './guideline-llm-builder';

export {
  DEFAULT_GOAL,
  platformFromFeature,
  templateRuleVi,
  templateRuleEn,
  resolveRuleBilingualText,
  buildPlaybookLlm,
};

/**
 * Generate a bilingual rule from a single pattern via OpenRouter BYOK.
 * Falls back to a template-derived rule when no LLM is configured.
 */
export async function generateRuleFromPattern(
  pattern: PlaybookPattern,
  platform: string,
  goal: string,
  llm?: (prompt: string) => Promise<string | null>,
): Promise<PlaybookRule> {
  const prompt = buildPlaybookPrompt(
    [
      {
        featureKey: pattern.featureKey,
        featureValue: pattern.featureValue,
        metric: pattern.metric,
        avgMetric: pattern.avgMetric,
        sampleSize: pattern.sampleSize,
        confidence: pattern.confidence,
        platform,
        goal,
      },
    ],
    platform,
    goal,
  );

  const { ruleVi, ruleEn } = await resolveRuleBilingualText(
    pattern,
    platform,
    goal,
    prompt,
    llm,
  );

  const rule: PlaybookRule = {
    id: `rule_${pattern.workspaceId}_${platform}_${goal}_${pattern.featureValue}`,
    workspaceId: pattern.workspaceId,
    patternId: pattern.id,
    platform,
    goal,
    ruleVi,
    ruleEn,
    confidence: pattern.confidence,
    sampleSize: pattern.sampleSize,
    appliedCount: 0,
    autoApply: pattern.confidence >= 0.9 && pattern.sampleSize >= 10,
    rollbackCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await upsertRule(rule);
  return rule;
}

/** Group patterns by platform + goal and generate one rule per group. */
export async function generateRulesForPatterns(
  patterns: PlaybookPattern[],
  llm?: (prompt: string) => Promise<string | null>,
): Promise<PlaybookRule[]> {
  const groups = new Map<string, { platform: string; goal: string; patterns: PlaybookPattern[] }>();
  for (const p of patterns) {
    const platform = platformFromFeature(p);
    const goal = DEFAULT_GOAL[platform] ?? 'awareness';
    const key = `${platform}|${goal}`;
    if (!groups.has(key)) groups.set(key, { platform, goal, patterns: [] });
    groups.get(key)!.patterns.push(p);
  }

  const rules: PlaybookRule[] = [];
  for (const group of groups.values()) {
    for (const p of group.patterns) {
      rules.push(await generateRuleFromPattern(p, group.platform, group.goal, llm));
    }
  }
  return rules;
}
