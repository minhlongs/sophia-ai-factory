/**
 * @module seed/ai/cost-estimator
 *
 * Static cost estimation for AI provider requests.
 *
 * Pricing is per 1K tokens (input + output) for text models, per
 * character for speech synthesis (ElevenLabs), and per-second for
 * video generation (WAN, Fish Speech).
 *
 * Prices are in USD and sourced from provider public pricing pages
 * as of 2026-06.  Update this table when providers change rates.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ChatMessage, ProviderId } from './provider-interface';
import { logger } from '@/seed/utils/logger-utility';

// ── Pricing primitives ────────────────────────────────────────────────────────

/** Cost per 1K input tokens (USD). */
type InputPrice = number;
/** Cost per 1K output tokens (USD). */
type OutputPrice = number;
/** Cost per character (USD) — for TTS providers. */
type PerCharPrice = number;
/** Cost per second of generated video (USD). */
type PerSecondPrice = number;

interface TextModelPricing {
  type: 'text';
  input: InputPrice;
  output: OutputPrice;
}

interface TtsModelPricing {
  type: 'tts';
  perChar: PerCharPrice;
}

interface VideoModelPricing {
  type: 'video';
  perSecond: PerSecondPrice;
}

type ModelPricing = TextModelPricing | TtsModelPricing | VideoModelPricing;

// ── Static pricing table ──────────────────────────────────────────────────────

/**
 * Model-level pricing table.
 *
 * Keys are canonical model identifiers as used by the provider
 * adapters.  Aliases map to the same entry (e.g. OpenRouter
 * prefixes).
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  // ── OpenRouter (OpenAI-compatible gateway) ─────────────────────────────────
  // OpenAI models via OpenRouter
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

  // ── Anthropic (direct Messages API — same model IDs as OpenRouter) ────────
  // The adapter normalises model IDs; we reuse the same entries.
  'claude-sonnet-4-6': { type: 'text', input: 3.0, output: 15.0 },
  'claude-opus-4': { type: 'text', input: 15.0, output: 75.0 },
  'claude-haiku-3-5': { type: 'text', input: 0.8, output: 4.0 },
  'claude-3-5-sonnet-20241022': { type: 'text', input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { type: 'text', input: 0.8, output: 4.0 },

  // ── ElevenLabs (TTS — per character) ──────────────────────────────────────
  // ElevenLabs bills per character of input text.
  'elevenlabs/eleven_multilingual_v2': { type: 'tts', perChar: 0.00003 },
  'elevenlabs/eleven_turbo_v2_5': { type: 'tts', perChar: 0.00003 },
  'elevenlabs/eleven_flash_v2_5': { type: 'tts', perChar: 0.000015 },
  'elevenlabs/eleven_monolingual_v1': { type: 'tts', perChar: 0.00003 },

  // ── WAN (video generation — per second) ────────────────────────────────────
  'wan/wan-2-1-t2v': { type: 'video', perSecond: 0.15 },
  'wan/wan-2-1-i2v': { type: 'video', perSecond: 0.20 },

  // ── Fish Speech (TTS — per character) ──────────────────────────────────────
  'fish-speech/fish-speech-1-5': { type: 'tts', perChar: 0.000005 },
};

// ── Provider-level defaults ───────────────────────────────────────────────────

/**
 * Fallback pricing when a model ID is not in the table.
 *
 * Used as a last resort so cost estimation never returns 0 silently.
 */
const PROVIDER_DEFAULTS: Record<ProviderId, ModelPricing> = {
  openrouter: { type: 'text', input: 1.0, output: 3.0 },
  anthropic: { type: 'text', input: 3.0, output: 15.0 },
  elevenlabs: { type: 'tts', perChar: 0.00003 },
  wan: { type: 'video', perSecond: 0.15 },
  'fish-speech': { type: 'tts', perChar: 0.000005 },
};

// ── Token estimation ──────────────────────────────────────────────────────────

/**
 * Rough token-count heuristic for cost estimation.
 *
 * Uses a character-based approximation (4 chars ≈ 1 token for
 * English, ~2.5 chars for Vietnamese).  This is intentionally
 * lightweight — it avoids importing a full tokeniser which would
 * add weight to the edge bundle.
 *
 * @param text — Text to estimate.
 * @returns Approximate token count.
 */
export function estimateTokenCount(text: string): number {
  // Detect CJK + Vietnamese characters (each is roughly 1 token).
  const cjkOrVn = (text.match(/[一-鿿぀-ゟ가-힯À-ɏẠ-ỿ]/g) ?? []).length;
  const remaining = text.length - cjkOrVn;
  // CJK/VN chars: ~1 token each; ASCII/other: ~4 chars per token.
  return Math.ceil(cjkOrVn + remaining / 4);
}

/**
 * Count tokens across a message array.
 *
 * Adds a small overhead per message for role tokens and formatting.
 */
export function countMessageTokens(messages: ChatMessage[]): number {
  const overheadPerMessage = 4; // role + formatting tokens
  let total = 0;
  for (const msg of messages) {
    total += estimateTokenCount(msg.content) + overheadPerMessage;
  }
  return total;
}

// ── Cost estimation ───────────────────────────────────────────────────────────

/**
 * Look up pricing for a model ID.
 *
 * Tries the full model ID first, then falls back to the provider
 * default.  Returns `undefined` only if the provider itself is
 * unknown (should not happen given the ProviderId union).
 */
function resolvePricing(modelId: string, providerId: ProviderId): ModelPricing | undefined {
  // Exact match.
  if (MODEL_PRICING[modelId]) return MODEL_PRICING[modelId];

  // Try stripping a vendor prefix (e.g. `openrouter/openai/gpt-4o`).
  const stripped = modelId.includes('/') ? modelId.split('/').pop()! : modelId;
  if (MODEL_PRICING[stripped]) return MODEL_PRICING[stripped];

  // Provider default.
  return PROVIDER_DEFAULTS[providerId];
}

/**
 * Estimate the USD cost for a chat completion request.
 *
 * For text models: counts input tokens from messages and projects
 * output tokens from `maxTokens` (or a heuristic if not provided).
 *
 * For TTS models: counts characters in the last user message.
 *
 * For video models: returns the per-second rate (caller supplies
 * duration).
 *
 * @param messages — Messages that will be sent.
 * @param model — Model identifier.
 * @param options — Additional options (maxTokens for output projection).
 * @returns Estimated cost in USD (rounded to 6 decimal places).
 */
export function estimateCost(
  messages: ChatMessage[],
  model: string,
  options?: { maxTokens?: number; providerId?: ProviderId },
): number {
  const providerId = options?.providerId ?? inferProvider(model);
  const pricing = resolvePricing(model, providerId);

  if (!pricing) {
    logger.warn('[CostEstimator] No pricing found for model', undefined, {
      model,
      providerId,
    });
    return 0;
  }

  switch (pricing.type) {
    case 'text': {
      const inputTokens = countMessageTokens(messages);
      // Project output tokens from maxTokens or a 50% heuristic of input.
      const maxTokens = options?.maxTokens ?? Math.ceil(inputTokens * 0.5);
      const outputTokens = Math.min(maxTokens, 4096); // cap at typical max
      const cost = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
      return Math.round(cost * 1_000_000) / 1_000_000;
    }

    case 'tts': {
      // TTS cost is based on the last user message character count.
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      const chars = lastUserMsg?.content.length ?? 0;
      const cost = chars * pricing.perChar;
      return Math.round(cost * 1_000_000) / 1_000_000;
    }

    case 'video': {
      // Video cost is per second — caller must pass the estimated
      // duration in `extraBody.durationSeconds`.
      const duration = (options?.maxTokens ?? 5) as number; // repurposed field
      const cost = duration * pricing.perSecond;
      return Math.round(cost * 1_000_000) / 1_000_000;
    }

    default:
      return 0;
  }
}

/**
 * Get the pricing entry for a model (for display / audit).
 *
 * @param model — Model identifier.
 * @param providerId — Provider identifier.
 * @returns Pricing entry or undefined if not found.
 */
export function getModelPricing(model: string, providerId: ProviderId): ModelPricing | undefined {
  return resolvePricing(model, providerId);
}

/**
 * Get all known model IDs for a provider.
 *
 * @param providerId — Provider identifier.
 * @returns Array of model IDs with known pricing.
 */
export function getModelsForProvider(providerId: ProviderId): string[] {
  const prefix = providerId === 'fish-speech' ? 'fish-speech/' : `${providerId}/`;
  return Object.keys(MODEL_PRICING).filter((id) => {
    if (providerId === 'anthropic') {
      // Anthropic direct API uses unprefixed IDs.
      return !id.includes('/') && id.startsWith('claude');
    }
    return id.startsWith(prefix);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Infer the provider from a model ID heuristically.
 *
 * Used when the caller does not supply a providerId.
 */
function inferProvider(modelId: string): ProviderId {
  const lower = modelId.toLowerCase();
  if (lower.startsWith('claude') || lower.startsWith('anthropic/')) return 'anthropic';
  if (lower.startsWith('eleven')) return 'elevenlabs';
  if (lower.startsWith('wan/') || lower.startsWith('wan-')) return 'wan';
  if (lower.startsWith('fish-speech/') || lower.startsWith('fish_')) return 'fish-speech';
  // Default: OpenRouter gateway handles everything else.
  return 'openrouter';
}
