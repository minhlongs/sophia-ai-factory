import type { ContextWindowConfig } from './types';

/**
 * Default context window limits for known models.
 *
 * Values sourced from provider documentation as of 2026-06.
 */
export const DEFAULT_MODEL_LIMITS: Record<string, ContextWindowConfig> = {
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    contextLimit: 128_000,
    consolidationThreshold: 0.75,
  },
  'claude-sonnet-4-6': {
    modelId: 'claude-sonnet-4-6',
    contextLimit: 200_000,
    consolidationThreshold: 0.75,
  },
  'deepseek-reasoner': {
    modelId: 'deepseek-reasoner',
    contextLimit: 64_000,
    consolidationThreshold: 0.7,
  },
};
