/**
 * Types, supported model catalog, and model check helper for MuAPI Media Generation Client.
 * @module tree/clients/muapi-media-types
 */

import { SUPPORTED_IMAGE_MODELS } from '@/seed/config/tiers/supported-image-models';

export const MUAPI_BASE = 'https://api.muapi.ai/v1';

export type MediaType = 'image' | 'video' | 'audio';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface MediaGenerationRequest {
  type: MediaType;
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  duration?: number;
  style?: string;
  seed?: number;
  imageUrl?: string;
}

export interface MediaJob {
  id: string;
  status: JobStatus;
  type: MediaType;
  model: string;
  resultUrl?: string;
  thumbnailUrl?: string;
  progress?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface MediaGenerationResult {
  success: boolean;
  job?: MediaJob;
  error?: string;
  code?: string;
}

/** Supported models per media type */
export const SUPPORTED_MODELS: Record<MediaType, string[]> = {
  image: [...SUPPORTED_IMAGE_MODELS],
  video: ['kling-3.0', 'seedance-2.0', 'veo3', 'kling-lip-sync'],
  audio: ['suno-v4', 'mmaudio'],
};

export function getMuApiKey(): string {
  const key = process.env.MUAPI_API_KEY;
  if (!key) throw new Error('MUAPI_API_KEY not configured');
  return key;
}

/**
 * Check if a model is supported
 */
export function isModelSupported(type: MediaType, model: string): boolean {
  return SUPPORTED_MODELS[type]?.includes(model) ?? false;
}
