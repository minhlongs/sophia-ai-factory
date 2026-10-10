import { logger } from '@/seed/utils/logger-utility'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind'
import { sleep } from './circuit-guard'
import { callAnthropicFallback } from './anthropic-fallback'
import type { ResilientOpenRouterOptions } from './types'

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const DEFAULT_MODEL = 'openai/gpt-4o-mini'

export async function callOpenRouter(
  apiKey: string,
  prompt: string,
  model: string = DEFAULT_MODEL,
  maxRetries: number = 3,
): Promise<string> {
  if (!shouldAllowRequest('openrouter')) {
    throw new Error('[OpenRouter] Circuit breaker open for openrouter')
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
        recordSuccess('openrouter')
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
        return data.choices?.[0]?.message?.content ?? ''
      }

      const errorBody = await res.text().catch((err) => {
        logger.warn('Failed to read OpenRouter error response', {
          error: String(err),
          context: 'callOpenRouter',
        })
        return ''
      })

      lastError = new Error(`OpenRouter HTTP ${res.status}: ${errorBody.slice(0, 200)}`)

      if (res.status === 401 || res.status === 403) {
        recordFailure('openrouter', classifyHttpStatus(res.status))
        ;(lastError as { retryable?: boolean }).retryable = false
        throw lastError
      }

      if (res.status === 429) {
        recordFailure('openrouter', classifyHttpStatus(res.status))
        if (attempt === maxRetries) throw lastError
        continue
      }

      if (res.status >= 500) {
        if (attempt === maxRetries) throw lastError
        continue
      }

      ;(lastError as { retryable?: boolean }).retryable = false
      throw lastError
    } catch (err) {
      if (err instanceof Error && err.message.includes('Circuit breaker')) throw err
      const typedErr = err as Error & { retryable?: boolean }
      if (typedErr.retryable === false) {
        throw err
      }
      lastError = typedErr
      if (attempt === maxRetries) {
        recordFailure('openrouter', classifyError(lastError))
        throw lastError
      }
    }
  }

  throw lastError ?? new Error('Unknown error')
}

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
        throw err
      }
    }

    throw err
  }
}
