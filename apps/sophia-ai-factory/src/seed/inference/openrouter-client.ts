/**
 * OpenRouter Resilient Client
 *
 * Features:
 * - Exponential backoff retry (429, 5xx)
 * - Circuit breaker (stop hammering when cooldown)
 * - Fallback to Anthropic (if configured)
 * - Retry-After header respect
 *
 * Migration note (Phase 6+): `multiProviderResilientChat` provides
 * provider-abstraction-aware resilience. Pass Provider instances directly
 * instead of API keys. The old `resilientChatCompletion` is unchanged.
 */

import { logger } from '@/seed/utils/logger-utility'
import type { Provider, ChatMessage, ChatOptions } from '@/seed/ai/provider-interface'
import { tokenCounter } from '@/seed/ai/token-counter'
import { DEFAULT_MODEL_LIMITS } from '@/seed/ai/context-window'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-4o-mini'
const SAFETY_BUFFER = 22_000
const HARD_CEILING = 240_000

interface CircuitState {

  failures: number
  openUntil: number
  lastError?: string
}

const circuit: CircuitState = { failures: 0, openUntil: 0 }
const CIRCUIT_FAILURES = 3
const CIRCUIT_RESET_MS = 60_000

function assertContextBudget(messages: ChatMessage[], modelId: string): void {
  const inputTokens = tokenCounter.estimateMessages(messages);
  const limit = DEFAULT_MODEL_LIMITS[modelId]?.contextLimit ?? 200_000;
  const safeLimit = Math.floor(limit * 0.95) - SAFETY_BUFFER;

  if (inputTokens > safeLimit) {
    throw new Error(
      `CONTEXT_OVERFLOW: ${inputTokens} tokens exceeds safe limit of ${safeLimit} ` +
      `(model limit ${limit} minus 5% margin minus ${SAFETY_BUFFER} buffer). ` +
      `Reduce conversation history or trigger summarization.`
    );
  }
}

function isCircuitOpen(): boolean {
  if (circuit.openUntil === 0) return false
  if (Date.now() < circuit.openUntil) return true
  circuit.failures = 0
  circuit.openUntil = 0
  return false
}

function recordFailure(error: { status?: number; retryAfter?: number; message?: string }): void {
  circuit.failures += 1
  circuit.lastError = error.message ?? String(error.status ?? 'unknown')

  if (circuit.failures >= CIRCUIT_FAILURES) {
    const retryAfterMs = (error.retryAfter ?? 60) * 1000
    circuit.openUntil = Date.now() + Math.min(retryAfterMs, CIRCUIT_RESET_MS)
    logger.warn('[openrouter-client] Circuit OPEN', {
      until: new Date(circuit.openUntil).toISOString(),
      reason: circuit.lastError,
    })
  }
}

function recordSuccess(): void {
  circuit.failures = 0
  circuit.openUntil = 0
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function callOpenRouter(
  apiKey: string,
  prompt: string,
  model: string = DEFAULT_MODEL,
  maxRetries: number = 3,
): Promise<string> {
  assertContextBudget([{ role: 'user', content: prompt }], model);

  if (isCircuitOpen()) {
    throw new Error('Circuit breaker OPEN - OpenRouter temporarily unavailable')
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(1000 * 2 ** attempt, 30000)
      await sleep(backoff + Math.random() * 500)
    }

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://sophia.agencyos.network',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          temperature: 0.3,
        }),
      })

      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        const content = data.choices?.[0]?.message?.content ?? ''
        recordSuccess()
        return content
      }

      const errorBody = await res.text().catch((err) => {
        logger.warn('Failed to read OpenRouter error response', { error: String(err), context: 'callOpenRouter' });
        return '';
      })
      const retryAfter = res.headers.get('Retry-After')
        ? parseInt(res.headers.get('Retry-After')!, 10)
        : undefined

      lastError = new Error(`OpenRouter HTTP ${res.status}: ${errorBody.slice(0, 200)}`)

      if (res.status === 401 || res.status === 403) {
        // Auth failure - don't retry, key invalid
        recordFailure({ status: res.status, message: `Auth failed: ${res.status}` })
        ;(lastError as { retryable?: boolean }).retryable = false
        throw lastError
      }

      if (res.status === 429) {
        recordFailure({ status: 429, retryAfter, message: 'Rate limited' })
        if (attempt === maxRetries) throw lastError
        continue
      }

      if (res.status >= 500) {
        if (attempt === maxRetries) throw lastError
        continue
      }

      // Other errors (4xx besides 429/401/403) - don't retry
      ;(lastError as { retryable?: boolean }).retryable = false
      throw lastError

    } catch (err) {
      if (err instanceof Error && err.message.includes('Circuit breaker')) throw err
      const typedErr = err as Error & { retryable?: boolean }
      if (typedErr.retryable === false) {
        // Non-retryable error, bubble immediately
        throw err
      }
      lastError = typedErr
      if (attempt === maxRetries) {
        recordFailure({ message: lastError.message })
        throw lastError
      }
      // retryable error — continue after backoff (already scheduled above)
    }
  }

  throw lastError ?? new Error('Unknown error')
}

async function callAnthropicFallback(
  apiKey: string,
  prompt: string,
  model: string = 'claude-haiku-3-5',
): Promise<string> {
  assertContextBudget([{ role: 'user', content: prompt }], model);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text().catch((err) => {
      logger.warn('Failed to read Anthropic error response', { error: String(err), context: 'callAnthropicFallback' });
      return '';
    })
    throw new Error(`Anthropic HTTP ${res.status}: ${errorBody.slice(0, 200)}`)
  }

  const data = await res.json() as { content?: { text?: string }[] }
  return data.content?.[0]?.text ?? ''
}

export interface ResilientOpenRouterOptions {
  openRouterKey: string | null
  anthropicKey?: string
  enableFallback?: boolean
  model?: string // OpenRouter model, e.g., 'anthropic/claude-haiku-4-5'
}

/**
 * Resilient chat completion with circuit breaker + fallback
 */
export async function resilientChatCompletion(
  prompt: string,
  { openRouterKey, anthropicKey, enableFallback = true, model }: ResilientOpenRouterOptions,
): Promise<string> {
  if (!openRouterKey) {
    if (anthropicKey && enableFallback) {
      logger.info('[openrouter-client] Using Anthropic fallback (no OpenRouter key)')
      return callAnthropicFallback(anthropicKey, prompt)
    }
    throw new Error('No OpenRouter API key configured')
  }

  try {
    return await callOpenRouter(openRouterKey, prompt, model)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn('[openrouter-client] OpenRouter failed, trying fallback', { error: message })

    if (anthropicKey && enableFallback && !message.includes('Auth failed')) {
      try {
        return await callAnthropicFallback(anthropicKey, prompt)
      } catch (fallbackErr) {
        logger.error('[openrouter-client] Fallback also failed', { error: String(fallbackErr) })
        throw err // original error
      }
    }

    throw err
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-provider resilient chat (opt-in)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Migration guide:
// Old: const result = await resilientChatCompletion(prompt, {
//        openRouterKey: key,
//        anthropicKey: fallbackKey,
//        enableFallback: true,
//      });
//
// New: const result = await multiProviderResilientChat(prompt, messages, {
//        primary: { provider: openRouterProvider, model: 'gpt-4o-mini' },
//        fallback: { provider: anthropicProvider, model: 'claude-haiku-3-5' },
//        maxRetriesPerProvider: 3,
//        timeoutMs: 120_000,
//      });
//      // Returns plain string — same as resilientChatCompletion
//
// The old resilientChatCompletion is UNCHANGED. This is purely additive.
// ═══════════════════════════════════════════════════════════════════════════════

export interface MultiProviderResilientOptions {
  /** Primary provider instance (e.g. OpenRouterProvider). */
  primary: {
    provider: Provider
    model?: string
  }
  /** Optional fallback provider (e.g. AnthropicProvider). */
  fallback?: {
    provider: Provider
    model?: string
  }
  /** Max retry attempts per provider before moving to fallback (default 3). */
  maxRetriesPerProvider?: number
  /** Per-request timeout in ms (default 120_000). */
  timeoutMs?: number
}

/**
 * Health-aware resilient chat using the provider abstraction layer.
 *
 * Accepts Provider instances directly (dependency injection) instead of
 * raw API keys. Retries with exponential backoff on retryable errors,
 * falls back to the secondary provider when primary is exhausted.
 *
 * This function is OPT-IN. Existing `resilientChatCompletion` callers
 * are unaffected.
 *
 * @param prompt — User prompt (used when messages is empty).
 * @param messages — Full conversation history (preferred over prompt).
 * @param options — Multi-provider configuration with Provider instances.
 * @returns Response text from the first successful provider.
 * @throws {Error} — All providers failed after max retries.
 */
export async function multiProviderResilientChat(
  prompt: string,
  messages: ChatMessage[],
  options: MultiProviderResilientOptions,
): Promise<string> {
  const maxRetries = options.maxRetriesPerProvider ?? 3
  const timeoutMs = options.timeoutMs ?? 120_000

  // Build the message list: use conversation history, fall back to prompt
  const chatMessages: ChatMessage[] =
    messages.length > 0
      ? messages
      : [{ role: 'user', content: prompt }]

  const primaryProvider = options.primary.provider
  const primaryModel = options.primary.model ?? primaryProvider.getCapabilities(
    primaryProvider.id === 'openrouter' ? DEFAULT_MODEL : 'claude-sonnet-4-6',
  )

  // Try primary provider with retries
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(1000 * 2 ** attempt, 30000)
      await sleep(backoff + Math.random() * 500)
    }

    try {
      const response = await primaryProvider.chat(chatMessages, {
        model: options.primary.model ?? (primaryProvider.id === 'openrouter' ? DEFAULT_MODEL : 'claude-sonnet-4-6'),
        apiKey: '', // Provider instances carry their own credentials
        timeoutMs,
      })
      return response.content
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const retryable = (lastError as Error & { retryable?: boolean }).retryable ?? true

      if (!retryable) {
        // Non-retryable error (e.g. auth failure) — skip to fallback immediately
        break
      }

      if (attempt === maxRetries) {
        logger.warn('[multiProviderResilientChat] Primary provider exhausted', {
          provider: primaryProvider.id,
          error: lastError.message,
        })
        break
      }

      logger.debug('[multiProviderResilientChat] Primary provider retry', {
        provider: primaryProvider.id,
        attempt: attempt + 1,
        maxRetries,
      })
    }
  }

  // Fallback to secondary provider if configured
  if (options.fallback) {
    const fallbackProvider = options.fallback.provider
    logger.info('[multiProviderResilientChat] Trying fallback provider', {
      provider: fallbackProvider.id,
    })

    try {
      const response = await fallbackProvider.chat(chatMessages, {
        model: options.fallback.model ?? (fallbackProvider.id === 'openrouter' ? DEFAULT_MODEL : 'claude-sonnet-4-6'),
        apiKey: '',
        timeoutMs,
      })
      return response.content
    } catch (fallbackErr) {
      const fallbackError = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr))
      logger.error('[multiProviderResilientChat] Fallback provider also failed', {
        provider: fallbackProvider.id,
        error: fallbackError.message,
      })
      throw lastError ?? fallbackError
    }
  }

  throw lastError ?? new Error('All providers failed')
}

export function resetOpenRouterCircuit(): void {
  circuit.failures = 0
  circuit.openUntil = 0
}

export function getOpenRouterCircuitState(): Readonly<CircuitState> {
  return { ...circuit }
}
