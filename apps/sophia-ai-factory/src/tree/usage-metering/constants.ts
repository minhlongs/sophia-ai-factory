/**
 * Usage Metering Constants
 *
 * Service definitions, credit mappings, and tier configurations
 */

import type { CreditRule } from './types';

/**
 * Service endpoint mappings
 */
export const SERVICE_ENDPOINTS = {
  heygen: {
    baseUrl: 'https://api.heygen.com/v2',
    endpoints: {
      createVideo: '/video/generate',
      getVideoStatus: '/video/:id',
      listAvatars: '/avatars',
      listVoices: '/voices',
    }
  },
  elevenlabs: {
    baseUrl: 'https://api.elevenlabs.io/v1',
    endpoints: {
      textToSpeech: '/text-to-speech/:voiceId',
      voices: '/voices',
    }
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    endpoints: {
      chatCompletion: '/chat/completions',
    }
  }
} as const;

/**
 * Credit calculation rules
 * 1 credit = 1 API call OR 1000 tokens
 */
export const CREDIT_RULES: Record<string, Record<string, CreditRule>> = {
  heygen: {
    createVideo: { type: 'per-call', credits: 1 },
    default: { type: 'per-call', credits: 1 },
  },
  elevenlabs: {
    textToSpeech: { type: 'per-call', credits: 1 },
    default: { type: 'per-call', credits: 1 },
  },
  openrouter: {
    chatCompletion: { type: 'per-1k-tokens', creditsPer1k: 1 },
    default: { type: 'per-call', credits: 1 },
  },
  'fal-ai': {
    imageGenerate: { type: 'per-call', credits: 1 },
    default: { type: 'per-call', credits: 1 },
  },
} as const;

/**
 * Tier-based rate multipliers
 * Applied to base credits for tiered pricing
 */
export const TIER_RATE_MULTIPLIERS = {
  BASIC: 1.0,
  PREMIUM: 0.8,      // 20% discount
  ENTERPRISE: 0.6,   // 40% discount
  MASTER: 0.5,       // 50% discount
} as const;
