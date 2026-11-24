/**
 * Script Prompt Builders
 *
 * Constructs LLM prompts and mock output for video script generation.
 *
 * @module ai/script-prompt-builders
 */

import type { PriorScriptSteering } from '@/seed/types/growth-triad-v16';

export interface ScriptOutput {
  title: string;
  scenes: {
    scene_number: number;
    title?: string;
    visual_description: string;
    narration: string;
    duration_estimate: number;
  }[];
  total_duration: number;
}

export const SCRIPT_SYSTEM_PROMPT =
  `You are an expert video script writer specializing in affiliate marketing content. Create engaging, conversion-focused scripts that hook viewers immediately and build desire for the product.`;

/** Optional affiliate offer to inject as CTA into the script */
export interface AffiliateOfferCta {
  productName: string;
  shortUrl: string;
}

/**
 * Build the user prompt for script generation.
 * If affiliateOffer is provided, injects a CTA line into the last scene instructions.
 * If steering is provided, injects Bayesian retention prior constraints and hook archetype guidance.
 * If durationSec is provided, specifies the requested target duration and allowed bounds.
 */
export function buildScriptUserPrompt(
  topic: string,
  audience: string,
  affiliateOffer?: AffiliateOfferCta,
  steering?: PriorScriptSteering,
  durationSec?: number
): string {
  const ctaLine = affiliateOffer
    ? `\n- End scene must include CTA: "Get ${affiliateOffer.productName} now at ${affiliateOffer.shortUrl}"`
    : '';

  const durationRequirement =
    typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0
      ? `Total duration: approximately ${durationSec} seconds (strictly within ${Math.ceil(Math.max(5, durationSec * 0.5))}-${Math.floor(durationSec * 1.5)} seconds)`
      : 'Total duration: 15-30 seconds';

  const exampleTotalDuration =
    typeof durationSec === 'number' && Number.isFinite(durationSec) && durationSec > 0
      ? durationSec
      : 16;

  let steeringLines = '';
  if (steering) {
    const parts: string[] = [];
    if (steering.targetHookDropoffThreshold !== undefined) {
      parts.push(`- Hook Dropoff Constraint: Target <${steering.targetHookDropoffThreshold}% viewer dropoff in the first 3 seconds.`);
    }
    if (steering.winningHookArchetype) {
      parts.push(`- Hook Archetype: Use "${steering.winningHookArchetype}" pattern for Scene 1.`);
    }
    if (steering.pacingDirective) {
      parts.push(`- Pacing & Rhythm: ${steering.pacingDirective}`);
    }
    if (steering.expectedRetentionMultiplier && steering.expectedRetentionMultiplier > 1.0) {
      parts.push(`- Retention Optimization: Apply high-retention cadence (retention multiplier ${steering.expectedRetentionMultiplier}x).`);
    }
    if (parts.length > 0) {
      steeringLines = `\n\nEmpirical Performance Constraints (Growth Feedback Prior):\n${parts.join('\n')}`;
    }
  }

  return `Create a video script for promoting a product about "${topic}" to ${audience}.

Requirements:
- Hook the viewer in the first 5 seconds
- 3-5 scenes total
- Each scene should have clear visual description and narration
- ${durationRequirement}
- Focus on benefits and transformation${ctaLine}${steeringLines}

Return ONLY valid JSON in this exact format:
{
  "title": "string",
  "scenes": [
    {
      "scene_number": 1,
      "title": "Short scene name",
      "visual_description": "string",
      "narration": "string",
      "duration_estimate": 5
    }
  ],
  "total_duration": ${exampleTotalDuration}
}`;
}

/**
 * Mock script generator for fallback or development.
 */
export function generateMockScript(topic: string, audience: string): ScriptOutput {
  return {
    title: `The Ultimate Guide to ${topic}`,
    scenes: [
      {
        scene_number: 1,
        visual_description: "Fast-paced montage of successful people working.",
        narration: `Are you tired of failing at ${topic}? You're not alone.`,
        duration_estimate: 5
      },
      {
        scene_number: 2,
        visual_description: "Graphic showing statistics rising.",
        narration: `In this video, I'm going to show you the secret method that ${audience} are using to dominate.`,
        duration_estimate: 8
      },
      {
        scene_number: 3,
        visual_description: "Host speaking directly to camera with confidence.",
        narration: "Let's dive in.",
        duration_estimate: 3
      }
    ],
    total_duration: 16
  };
}
