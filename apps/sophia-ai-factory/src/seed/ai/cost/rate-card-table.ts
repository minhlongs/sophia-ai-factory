/**
 * @module seed/ai/cost/rate-card-table
 * Static model rate cards and provider pricing tables.
 * Layer rule: seed only.
 */

import type { ProviderId } from '../provider-interface';
import type { CostKind, ModelPricing } from './types';

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenRouter (OpenAI-compatible gateway)
  'openai/gpt-4o': { type: 'text', input: 2.5, output: 10.0 },
  'openai/gpt-4o-mini': { type: 'text', input: 0.15, output: 0.6 },
  'openai/gpt-4-turbo': { type: 'text', input: 10.0, output: 30.0 },
  'openai/o3': { type: 'text', input: 10.0, output: 40.0 },
  'openai/o4-mini': { type: 'text', input: 1.1, output: 4.4 },

  // Anthropic models via OpenRouter
  'anthropic/claude-sonnet-4-6': { type: 'text', input: 3.0, output: 15.0 },
  'anthropic/claude-opus-4': { type: 'text', input: 15.0, output: 75.0 },
  'anthropic/claude-haiku-3-5': { type: 'text', input: 0.8, output: 4.0 },

  // Google models via OpenRouter
  'google/gemini-2-5-pro': { type: 'text', input: 1.25, output: 5.0 },
  'google/gemini-2-5-flash': { type: 'text', input: 0.15, output: 0.6 },

  // Meta / Llama via OpenRouter
  'meta-llama/llama-4-maverick': { type: 'text', input: 0.2, output: 0.6 },
  'meta-llama/llama-4-scout': { type: 'text', input: 0.1, output: 0.3 },

  // Mistral via OpenRouter
  'mistral/mistral-large': { type: 'text', input: 2.0, output: 6.0 },
  'mistral/mistral-small': { type: 'text', input: 0.2, output: 0.6 },

  // DeepSeek via OpenRouter
  'deepseek/deepseek-chat': { type: 'text', input: 0.14, output: 0.28 },
  'deepseek/deepseek-reasoner': { type: 'text', input: 0.55, output: 2.19 },

  // Anthropic (direct Messages API — same model IDs as OpenRouter)
  'claude-sonnet-4-6': { type: 'text', input: 3.0, output: 15.0 },
  'claude-opus-4': { type: 'text', input: 15.0, output: 75.0 },
  'claude-haiku-3-5': { type: 'text', input: 0.8, output: 4.0 },
  'claude-3-5-sonnet-20241022': { type: 'text', input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { type: 'text', input: 0.8, output: 4.0 },

  // ElevenLabs (TTS — per character)
  'elevenlabs/eleven_multilingual_v2': { type: 'tts', perChar: 0.00003 },
  'elevenlabs/eleven_turbo_v2_5': { type: 'tts', perChar: 0.00003 },
  'elevenlabs/eleven_flash_v2_5': { type: 'tts', perChar: 0.000015 },
  'elevenlabs/eleven_monolingual_v1': { type: 'tts', perChar: 0.00003 },

  // WAN (video generation — per second)
  'wan/wan-2-1-t2v': { type: 'video', perSecond: 0.15 },
  'wan/wan-2-1-i2v': { type: 'video', perSecond: 0.20 },

  // Fish Speech (TTS — per character)
  'fish-speech/fish-speech-1-5': { type: 'tts', perChar: 0.000005 },
};

export const PROVIDER_DEFAULTS: Record<ProviderId, ModelPricing> = {
  openrouter: { type: 'text', input: 1.0, output: 3.0 },
  anthropic: { type: 'text', input: 3.0, output: 15.0 },
  elevenlabs: { type: 'tts', perChar: 0.00003 },
  wan: { type: 'video', perSecond: 0.15 },
  'fish-speech': { type: 'tts', perChar: 0.000005 },
};

export const PROVIDER_COST_KIND: Record<ProviderId, CostKind> = {
  openrouter: 'metered',
  anthropic: 'metered',
  elevenlabs: 'metered',
  wan: 'metered',
  'fish-speech': 'metered',
};

export function resolvePricing(modelId: string, providerId: ProviderId): ModelPricing | undefined {
  if (MODEL_PRICING[modelId]) return MODEL_PRICING[modelId];

  const stripped = modelId.includes('/') ? modelId.split('/').pop()! : modelId;
  if (MODEL_PRICING[stripped]) return MODEL_PRICING[stripped];

  return PROVIDER_DEFAULTS[providerId];
}

export function inferProvider(modelId: string): ProviderId {
  const lower = modelId.toLowerCase();
  if (lower.startsWith('claude') || lower.startsWith('anthropic/')) return 'anthropic';
  if (lower.startsWith('eleven')) return 'elevenlabs';
  if (lower.startsWith('wan/') || lower.startsWith('wan-')) return 'wan';
  if (lower.startsWith('fish-speech/') || lower.startsWith('fish_')) return 'fish-speech';
  return 'openrouter';
}
