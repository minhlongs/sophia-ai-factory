/**
 * Barrel export for youtube-strategy modules.
 * Re-exports all public APIs; excludes conflicting names from index-level re-export.
 */

export * from './trend-scorer';
export * from './competitor-analyzer';
export * from './strategy-generator';
export * from './claim-extractor';
export * from './learning-engine';
export * from './measurement-windows';
export * from './quality-gate';
export * from './provenance-reviewer';
export * from './recovery-checkpoint';

// script-writer — export everything except types that conflict with seo-optimizer/chapter-generator
export {
  generateScript,
  parseAIScriptResponse,
  estimateDuration,
  formatDuration,
  type ScriptHook,
  type ScriptIntroduction,
  type ScriptMainContent,
  type ScriptContentSection,
  type ScriptConclusion,
  type ScriptCTA,
  type GeneratedScript,
  type ScriptStrategy,
} from './script-writer';

// script-templates — export format utilities and the template type
export {
  SCRIPT_TEMPLATES,
  getTemplate,
  requiredSections,
  allSections,
  type ScriptTemplate,
  type ScriptFormat,
} from './script-templates';

// seo-optimizer — export SEO utilities (ChapterEntry, generateChapters come from chapter-generator)
export {
  optimizeTitle,
  generateDescription,
  generateTags,
  generateHashtags,
  calculateSEOScore,
  type SEOOptimizationInput,
  type ScriptForSEO,
  type SEOResult,
} from './seo-optimizer';

// tag-generator
export {
  generatePrioritizedTags,
  scoreTag,
  enforceCharLimit,
  type TagInput,
} from './tag-generator';

// chapter-generator — canonical source for ChapterEntry and generateChapters
export {
  generateChapters,
  formatTimestamp,
  validateChapters,
  totalDuration,
  type ChapterEntry,
  type ScriptSection as ChapterScriptSection,
  type ChapterInput,
} from './chapter-generator';
