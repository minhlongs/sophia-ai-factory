/**
 * Artifact validation and retry classification helpers for YouTube generation checkpoints.
 * @module tree/youtube-strategy/recovery-checkpoint-helpers
 */

import type { GenerationStage } from './recovery-checkpoint';

export const GENERATION_STAGES: readonly GenerationStage[] = [
  'strategy',
  'script',
  'thumbnail',
  'seo',
  'production',
  'quality_review',
];

export function validateArtifact(stage: GenerationStage, artifact: unknown): boolean {
  if (!artifact || typeof artifact !== 'object') return false;
  const a = artifact as Record<string, unknown>;
  switch (stage) {
    case 'strategy':
      return Boolean(a.topic);
    case 'script':
      return Boolean(a.title && (a.fullScript || a.mainContent));
    case 'thumbnail':
      return Boolean(a.path);
    case 'seo':
      return Boolean(a.title && a.description && Array.isArray(a.tags));
    case 'production': {
      const finalVideo = (a.assets as Record<string, unknown> | undefined)?.finalVideo;
      return Boolean(a.id && (finalVideo as Record<string, unknown> | undefined)?.path);
    }
    case 'quality_review':
      return Boolean(a.contentId && a.reviewStatus);
    default:
      return false;
  }
}

export function isRetryable(error: unknown): boolean {
  const err = error as { status?: number; code?: string; response?: { status?: number } };
  const status = Number(err.status ?? err.response?.status ?? 0);
  if ([408, 425, 429].includes(status) || status >= 500) return true;
  const code = String(err.code ?? '').toUpperCase();
  return [
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ETIMEDOUT',
    'ENETUNREACH',
    'EAI_AGAIN',
  ].includes(code);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
