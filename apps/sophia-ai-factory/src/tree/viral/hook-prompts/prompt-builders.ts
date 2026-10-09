/**
 * @file prompt-builders.ts
 * @description LLM prompt builders for psychological hooks and high-retention scripts.
 * @layer tree
 */

import type { ViralNiche, HookArchetype, ViralHook } from '@/seed/types/growth';
import { NICHE_PROFILES, ARCHETYPE_DEFINITIONS } from './niche-profiles';

/**
 * Build LLM prompt for generating psychological short-form viral hooks.
 */
export function buildHookGenerationPrompt(
  niche: ViralNiche,
  archetype?: HookArchetype,
  customTopic?: string,
  locale: 'en' | 'vi' = 'en',
): { systemPrompt: string; userPrompt: string } {
  const profile = NICHE_PROFILES[niche];
  const archetypeInfo = archetype ? ARCHETYPE_DEFINITIONS[archetype] : null;

  const systemPrompt = [
    'You are the Chief Growth Viral Architect at Sophia AI Factory.',
    'Your specialty is engineering hyper-engaging opening hooks (first 3-5 seconds) for TikTok, YouTube Shorts, and X.',
    'Every hook must trigger intense curiosity, emotional pattern interruption, or cognitive dissonance.',
    'You adhere strictly to short-form retention mechanics: 0 fluff, punchy rhythm, vivid vocabulary, high stakes.',
    locale === 'vi'
      ? 'Output both English and natural, high-converting Vietnamese versions.'
      : 'Output compelling English copy with localized cultural resonance.',
  ].join(' ');

  const userPrompt = [
    `Target Niche: ${profile.name} (${profile.nameVi})`,
    `Target Audience: ${profile.targetAudience}`,
    `Audience Pain Points: ${profile.primaryPains.join('; ')}`,
    `Audience Core Desires: ${profile.desires.join('; ')}`,
    archetypeInfo
      ? `Required Hook Archetype: ${archetypeInfo.name} (${archetypeInfo.nameVi}) - Mechanism: ${archetypeInfo.psychologicalMechanism}`
      : 'Generate 5 variants spanning the 5 core archetypes: Curiosity Gap, Shocking Stat, Direct Question, Problem-Solution, and Contrarian.',
    customTopic ? `Focus Topic / Offer: ${customTopic}` : '',
    'Provide output in structured JSON matching the ViralHook schema.',
  ]
    .filter(Boolean)
    .join('\n');

  return { systemPrompt, userPrompt };
}

/**
 * Build LLM prompt for full viral short-form video script generation.
 */
export function buildScriptPrompt(
  niche: ViralNiche,
  hook: ViralHook,
  targetDurationSec: 15 | 30 | 60 = 30,
  locale: 'en' | 'vi' = 'en',
): { systemPrompt: string; userPrompt: string } {
  const profile = NICHE_PROFILES[niche];

  const systemPrompt = [
    'You are a world-class viral video copywriter for short-form video (TikTok, YouTube Shorts, X Reels).',
    'Write high-retention video scripts that guide the viewer from pattern interrupt to qualified funnel signup.',
    `Target duration is exactly ${targetDurationSec} seconds.`,
    'Sections must include: hook (3-5s), problem agitation (5-8s), core solution (10-15s), social proof/demo (4-5s), and clear CTA (4-5s).',
    locale === 'vi' ? 'Provide bilingual English and conversational Vietnamese.' : 'Provide high-impact English copy.',
  ].join(' ');

  const userPrompt = [
    `Niche: ${profile.name}`,
    `Selected Hook: "${hook.hookText}" (Vietnamese: "${hook.hookTextVi}")`,
    `Hook Archetype: ${hook.archetype}`,
    `Target Duration: ${targetDurationSec} seconds`,
    'Structure each section with narration, visualCue, onScreenText, and durationSec.',
    'End with an irresistible Call-To-Action directing viewers to our Telegram sales bot or website.',
  ].join('\n');

  return { systemPrompt, userPrompt };
}
