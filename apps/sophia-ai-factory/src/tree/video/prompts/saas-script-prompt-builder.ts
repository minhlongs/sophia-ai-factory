/**
 * SaaS Script Prompt Builder
 *
 * Generates conversion-optimized system and user prompts for SaaS AI video scripts.
 * Layer: tree (domain reusable prompt synthesis)
 * @module tree/video/prompts/saas-script-prompt-builder
 */

import type { VideoBlueprint } from '@/seed/config/video-blueprints/blueprint-types';

export interface ScriptPromptPair {
  systemPrompt: string;
  userPrompt: string;
}

export interface SaasScriptPromptInput {
  productName: string;
  targetAudience?: string;
  coreBenefit?: string;
  competitorName?: string;
  trialOffer?: string;
  vanityCoupon?: string | null;
  blueprint: VideoBlueprint;
  locale?: 'en' | 'vi';
}

export function buildSaasScriptPrompt(input: SaasScriptPromptInput): ScriptPromptPair {
  const {
    productName,
    targetAudience = 'solopreneurs and growth teams',
    coreBenefit = 'automate manual repetitive workflows',
    competitorName = 'legacy software',
    trialOffer = '14-day free trial with 50 bonus credits',
    vanityCoupon,
    blueprint,
    locale = 'en',
  } = input;

  const couponText = vanityCoupon ? `using code "${vanityCoupon}"` : '';

  const systemPrompt = [
    'You are a world-class Direct Response Copywriter and Video Scriptwriter specializing in Global B2B/SaaS software.',
    'Your goal is generating viral, high-converting video scripts for YouTube Shorts, TikTok, and Instagram Reels.',
    'CRITICAL GUIDELINES:',
    '- Hook (0-3s): Visceral, direct pain point or bold polarizing statement. No "Hey guys" or generic intros.',
    '- Agitation: Quantifiable wasted hours, spreadsheet chaos, or latency lag.',
    '- Solution: 3-step automated flow, 300ms cut rhythm, zero fluff.',
    '- Proof: Contrast Before vs After metrics (e.g., 8 hours to 45 seconds).',
    `- CTA: Direct friction removal pointing to link in pinned comment / bio ${couponText}.`,
    `- Output language: ${locale === 'vi' ? 'Vietnamese' : 'English'}.`,
    '- Maximum narration length: 130-150 words total (timed strictly for a 60-second video).',
  ].join('\n');

  const sceneDirectives = blueprint.scenes
    .map(
      (s) =>
        `- Scene ${s.sceneIndex + 1} (${s.name}, ${s.startSec}s-${s.endSec}s): ${s.pacingDesc}. Overlay text recommendation: "${s.overlayText || ''}".`,
    )
    .join('\n');

  const userPrompt = [
    `Create a high-converting 60-second video script for "${productName}".`,
    `Niche: SaaS Global (Target: ${targetAudience}).`,
    `Blueprint: ${blueprint.name} (${blueprint.hookArchetype}).`,
    `Core Benefit: ${coreBenefit}.`,
    blueprint.id === 'saas_tool_battle_vs' ? `Primary Competitor: ${competitorName}.` : '',
    `Offer Details: ${trialOffer}.`,
    vanityCoupon ? `Promo Code: ${vanityCoupon}.` : '',
    '',
    'SCENE STRUCTURE REQUIRED BY BLUEPRINT:',
    sceneDirectives,
    '',
    'Return your response in clean JSON format with keys:',
    '- hookLine: The exact opening 0-3s spoken words.',
    '- scriptNarration: Full narration text divided scene by scene.',
    '- pinnedCommentText: The high-converting pinned comment with call-to-action.',
    '- estimatedDurationSec: Number of seconds (must be 60).',
  ]
    .filter(Boolean)
    .join('\n');

  return { systemPrompt, userPrompt };
}
