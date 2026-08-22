/**
 * Per-format script structure definitions for YouTube content.
 * Each template defines section flow, tone, and pacing.
 */

export interface ScriptSection {
  readonly name: string;
  readonly required: boolean;
}

export interface ScriptTemplate {
  readonly structure: readonly ScriptSection[];
  readonly tone: string;
  readonly pacing: string;
}

export type ScriptFormat = 'tutorial' | 'explainer' | 'list' | 'review' | 'story';

export const SCRIPT_TEMPLATES: Record<ScriptFormat, ScriptTemplate> = {
  tutorial: {
    structure: [
      { name: 'hook', required: true },
      { name: 'introduction', required: true },
      { name: 'problem', required: true },
      { name: 'solution_steps', required: true },
      { name: 'demonstration', required: false },
      { name: 'recap', required: false },
      { name: 'cta', required: true },
    ],
    tone: 'educational',
    pacing: 'moderate',
  },
  explainer: {
    structure: [
      { name: 'hook', required: true },
      { name: 'question', required: true },
      { name: 'background', required: true },
      { name: 'explanation', required: true },
      { name: 'examples', required: false },
      { name: 'implications', required: false },
      { name: 'summary', required: false },
      { name: 'cta', required: true },
    ],
    tone: 'informative',
    pacing: 'steady',
  },
  list: {
    structure: [
      { name: 'hook', required: true },
      { name: 'introduction', required: true },
      { name: 'list_items', required: true },
      { name: 'bonus_item', required: false },
      { name: 'summary', required: false },
      { name: 'cta', required: true },
    ],
    tone: 'engaging',
    pacing: 'quick',
  },
  review: {
    structure: [
      { name: 'hook', required: true },
      { name: 'introduction', required: true },
      { name: 'overview', required: true },
      { name: 'pros', required: true },
      { name: 'cons', required: true },
      { name: 'comparison', required: false },
      { name: 'verdict', required: true },
      { name: 'cta', required: true },
    ],
    tone: 'analytical',
    pacing: 'detailed',
  },
  story: {
    structure: [
      { name: 'hook', required: true },
      { name: 'setup', required: true },
      { name: 'conflict', required: true },
      { name: 'journey', required: true },
      { name: 'climax', required: true },
      { name: 'resolution', required: true },
      { name: 'lesson', required: false },
      { name: 'cta', required: true },
    ],
    tone: 'narrative',
    pacing: 'dynamic',
  },
} as const;

/**
 * Get template for a given format, falling back to explainer.
 */
export function getTemplate(format: string): ScriptTemplate {
  const normalized = format.toLowerCase() as ScriptFormat;
  return SCRIPT_TEMPLATES[normalized] ?? SCRIPT_TEMPLATES.explainer;
}

/**
 * List all required section names for a given format.
 */
export function requiredSections(format: string): string[] {
  return getTemplate(format).structure
    .filter((s) => s.required)
    .map((s) => s.name);
}

/**
 * List all section names (required + optional) for a given format.
 */
export function allSections(format: string): string[] {
  return getTemplate(format).structure.map((s) => s.name);
}
