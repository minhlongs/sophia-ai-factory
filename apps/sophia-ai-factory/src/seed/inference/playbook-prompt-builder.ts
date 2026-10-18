/**
 * Playbook rule-generation prompt builder for AI inference.
 * Layer: seed (primitives — reusable by any layer).
 *
 * @module seed/inference/playbook-prompt-builder
 */

/** A single playbook pattern presented to the LLM for rule generation */
export interface PlaybookPatternInput {
  featureKey: string;
  featureValue: string;
  metric: string;
  avgMetric: number;
  sampleSize: number;
  confidence: number;
  platform: string;
  goal: string;
}

/**
 * Build the playbook rule-generation prompt from detected patterns.
 * The LLM returns bilingual (vi + en) rule text grouped by platform + goal.
 *
 * @param patterns - detected winning patterns for one workspace
 * @param platform - the ChannelProvider value this rule targets
 * @param goal - the business goal (awareness | conversion | retention)
 */
export function buildPlaybookPrompt(
  patterns: PlaybookPatternInput[],
  platform: string,
  goal: string,
): string {
  const lines = patterns.map(p =>
    `- ${p.featureKey}="${p.featureValue}" | metric=${p.metric} avg=${p.avgMetric} | n=${p.sampleSize} | conf=${Math.round(p.confidence * 100)}%`,
  ).join('\n');

  return `You are a content playbook strategist. Given these auto-detected winning patterns, write ONE concise content rule for the "${platform}" platform targeting the "${goal}" goal.

Detected patterns:
${lines || 'No patterns detected — say insufficient data'}

Write the rule in BOTH Vietnamese and English. Respond ONLY with valid JSON:
{
  "rule_vi": "<one sentence, Vietnamese>",
  "rule_en": "<one sentence, English>",
  "rationale": "<why this rule works, one sentence>"
}`;
}
