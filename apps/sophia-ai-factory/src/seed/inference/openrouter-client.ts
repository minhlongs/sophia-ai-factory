/**
 * OpenRouter Resilient Client
 *
 * Features:
 * - Exponential backoff retry (429, 5xx)
 * - Circuit breaker (stop hammering when cooldown)
 * - Fallback to Anthropic (if configured)
 * - Retry-After header respect
 */

import { logger } from '@/seed/utils/logger-utility';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

interface CircuitState {
  failures: number;
  openUntil: number;
  lastError?: string;
}

const circuit: CircuitState = { failures: 0, openUntil: 0 };
const CIRCUIT_FAILURES = 3;
const CIRCUIT_RESET_MS = 60_000;

function isCircuitOpen(): boolean {
  if (circuit.openUntil === 0) return false;
  if (Date.now() < circuit.openUntil) return true;
  circuit.failures = 0;
  circuit.openUntil = 0;
  return false;
}

function recordFailure(error: { status?: number; retryAfter?: number; message?: string }): void {
  circuit.failures += 1;
  circuit.lastError = error.message ?? String(error.status ?? 'unknown');

  if (circuit.failures >= CIRCUIT_FAILURES) {
    const retryAfterMs = (error.retryAfter ?? 60) * 1000;
    circuit.openUntil = Date.now() + Math.min(retryAfterMs, CIRCUIT_RESET_MS);
    logger.warn('[openrouter-client] Circuit OPEN', {
      until: new Date(circuit.openUntil).toISOString(),
      reason: circuit.lastError,
    });
  }
}

function recordSuccess(): void {
  circuit.failures = 0;
  circuit.openUntil = 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callOpenRouter(
  apiKey: string,
  prompt: string,
  model: string = DEFAULT_MODEL,
  maxRetries: number = 3,
): Promise<string> {
  if (isCircuitOpen()) {
    throw new Error('Circuit breaker OPEN - OpenRouter temporarily unavailable');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(1000 * 2 ** attempt, 30000);
      await sleep(backoff + Math.random() * 500);
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
      });

      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content ?? '';
        recordSuccess();
        return content;
      }

      const errorBody = await res.text().catch(() => '');
      const retryAfter = res.headers.get('Retry-After')
        ? parseInt(res.headers.get('Retry-After')!, 10)
        : undefined;

      lastError = new Error(`OpenRouter HTTP ${res.status}: ${errorBody.slice(0, 200)}`);

      if (res.status === 401 || res.status === 403) {
        // Auth failure - don't retry, key invalid
        recordFailure({ status: res.status, message: `Auth failed: ${res.status}` });
        lastError.retryable = false;
        throw lastError;
      }

      if (res.status === 429) {
        recordFailure({ status: 429, retryAfter, message: 'Rate limited' });
        if (attempt === maxRetries) throw lastError;
        continue;
      }

      if (res.status >= 500) {
        if (attempt === maxRetries) throw lastError;
        continue;
      }

      // Other errors (4xx besides 429/401/403) - don't retry
      lastError.retryable = false;
      throw lastError;

    } catch (err) {
      if (err instanceof Error && err.message.includes('Circuit breaker')) throw err;
      const typedErr = err as Error & { retryable?: boolean };
      if (typedErr.retryable === false) {
        // Non-retryable error, bubble immediately
        throw err;
      }
      lastError = typedErr;
      if (attempt === maxRetries) {
        recordFailure({ message: lastError.message });
        throw lastError;
      }
      // retryable error — continue after backoff (already scheduled above)
    }
  }

  throw lastError ?? new Error('Unknown error');
}

async function callAnthropicFallback(
  apiKey: string,
  prompt: string,
  model: string = 'claude-haiku-3-5',
): Promise<string> {
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
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`Anthropic HTTP ${res.status}: ${errorBody.slice(0, 200)}`);
  }

  const data = await res.json() as { content?: { text?: string }[] };
  return data.content?.[0]?.text ?? '';
}

export interface ResilientOpenRouterOptions {
  openRouterKey: string | null;
  anthropicKey?: string;
  enableFallback?: boolean;
  model?: string; // OpenRouter model, e.g., 'anthropic/claude-haiku-4-5'
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
      logger.info('[openrouter-client] Using Anthropic fallback (no OpenRouter key)');
      return callAnthropicFallback(anthropicKey, prompt);
    }
    throw new Error('No OpenRouter API key configured');
  }

  try {
    return await callOpenRouter(openRouterKey, prompt, model);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[openrouter-client] OpenRouter failed, trying fallback', { error: message });

    if (anthropicKey && enableFallback && !message.includes('Auth failed')) {
      try {
        return await callAnthropicFallback(anthropicKey, prompt);
      } catch (fallbackErr) {
        logger.error('[openrouter-client] Fallback also failed', { error: String(fallbackErr) });
        throw err; // original error
      }
    }

    throw err;
  }
}

export function resetOpenRouterCircuit(): void {
  circuit.failures = 0;
  circuit.openUntil = 0;
}

export function getOpenRouterCircuitState(): Readonly<CircuitState> {
  return { ...circuit };
}
