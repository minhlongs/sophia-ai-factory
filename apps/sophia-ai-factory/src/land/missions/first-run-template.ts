/**
 * First-Run Mission Templates — Pre-tested starter configurations for CEO onboarding.
 * Provides 3 optimized formats with safe defaults for immediate video generation.
 *
 * @module land/missions/first-run-template
 */

import { FIRST_RUN_TEMPLATES } from './first-run-template-catalog';

export { FIRST_RUN_TEMPLATES };

export type TemplateId = 'viral_shorts_explainer' | 'affiliate_product_showcase' | 'daily_news_wisdom';

export interface LocalizedString {
  en: string;
  vi: string;
}

export interface FirstRunTemplate {
  id: TemplateId;
  name: LocalizedString;
  description: LocalizedString;
  badge: LocalizedString;
  durationSeconds: number;
  aspectRatio: '9:16';
  targetPlatform: 'youtube_shorts' | 'tiktok' | 'instagram_reels';
  targetWordCount: number;
  estimatedScenes: number;
  defaultTopic: LocalizedString;
  suggestedPrompts: LocalizedString[];
  voiceStyle: string;
  visualStyle: string;
  callToAction: LocalizedString;
}

/** Get all 3 starter templates */
export function getFirstRunTemplates(): FirstRunTemplate[] {
  return Object.values(FIRST_RUN_TEMPLATES);
}

/** Get template by ID with safe fallback */
export function getTemplateById(id: string): FirstRunTemplate | undefined {
  return FIRST_RUN_TEMPLATES[id as TemplateId];
}

/** Default starter template for first-run experience */
export function getDefaultTemplate(): FirstRunTemplate {
  return FIRST_RUN_TEMPLATES.viral_shorts_explainer;
}
