import { logger } from '@/seed/utils/logger-utility'
import type { ChatMessage } from '@/seed/ai/provider-interface'
import { sleep } from './circuit-guard'
import { DEFAULT_MODEL } from './openrouter-caller'
import type { MultiProviderResilientOptions } from './types'

export async function multiProviderResilientChat(
  prompt: string,
  messages: ChatMessage[],
  options: MultiProviderResilientOptions,
): Promise<string> {
  const maxRetries = options.maxRetriesPerProvider ?? 3
  const timeoutMs = options.timeoutMs ?? 120_000

  const chatMessages: ChatMessage[] =
    messages.length > 0 ? messages : [{ role: 'user', content: prompt }]

  const primaryProvider = options.primary.provider

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(1000 * 2 ** attempt, 30000)
      await sleep(backoff + Math.random() * 500)
    }

    try {
      const response = await primaryProvider.chat(chatMessages, {
        model:
          options.primary.model ??
          (primaryProvider.id === 'openrouter' ? DEFAULT_MODEL : 'claude-sonnet-4-6'),
        apiKey: '',
        timeoutMs,
      })
      return response.content
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const retryable = (lastError as Error & { retryable?: boolean }).retryable ?? true

      if (!retryable) {
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

  if (options.fallback) {
    const fallbackProvider = options.fallback.provider
    logger.info('[multiProviderResilientChat] Trying fallback provider', {
      provider: fallbackProvider.id,
    })

    try {
      const response = await fallbackProvider.chat(chatMessages, {
        model:
          options.fallback.model ??
          (fallbackProvider.id === 'openrouter' ? DEFAULT_MODEL : 'claude-sonnet-4-6'),
        apiKey: '',
        timeoutMs,
      })
      return response.content
    } catch (fallbackErr) {
      const fallbackError =
        fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr))
      logger.error('[multiProviderResilientChat] Fallback provider also failed', {
        provider: fallbackProvider.id,
        error: fallbackError.message,
      })
      throw lastError ?? fallbackError
    }
  }

  throw lastError ?? new Error('All providers failed')
}
