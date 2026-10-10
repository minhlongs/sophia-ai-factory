/**
 * Quality Scorer Types & Evaluation Dictionaries
 *
 * Layer: tree/marketplace/scoring
 */
import type {
  TemplateEvaluationInput,
  QualityScoreResult,
  QualityDimensionBreakdown,
  DimensionScore,
} from '../types';
export type {
  TemplateEvaluationInput,
  QualityScoreResult,
  QualityDimensionBreakdown,
  DimensionScore,
};
export interface SceneParsed {
  visualPrompt?: string;
  voiceoverScript?: string;
  durationSeconds?: number;
}
export const COMMERCIAL_NICHES = new Set([
  'saas',
  'finance',
  'ecommerce',
  'growth_hacking',
  'tech',
  'technology',
]);
export const VIRAL_POWER_WORDS = [
  'secret',
  'stop',
  'mistake',
  'revealed',
  'nobody talks about',
  'warning',
  'shocking',
  'proven',
  'hack',
  'truth',
  'exposed',
  "don't",
  'avoid',
  'never',
];
export const CTA_KEYWORDS = [
  'comment',
  'link in bio',
  'try now',
  'follow',
  'share',
  'click',
  'check out',
  'download',
  'subscribe',
  'save this',
];
export const TRANSITION_MARKERS = [
  'but',
  'however',
  'suddenly',
  'until',
  'meanwhile',
  'yet',
  'because',
  'what happens next',
  "here's why",
];
export function extractWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}
export function parseStoryboardScenes(storyboard: unknown): SceneParsed[] {
  if (Array.isArray(storyboard)) {
    return storyboard as SceneParsed[];
  }
  if (typeof storyboard === 'string' && storyboard.trim().length > 0) {
    try {
      const parsed = JSON.parse(storyboard) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as SceneParsed[];
      }
    } catch {
      return [];
    }
  }
  return [];
}
