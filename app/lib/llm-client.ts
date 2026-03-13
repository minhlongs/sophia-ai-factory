// LLM Client for Sophia AI Factory
// Provides simple interface to interact with local LLMs via Ollama

import type { LLMRequest, LLMResponse, LLMError } from './llm-types.js'

const DEFAULT_MODEL = process.env.LLM_MODEL || 'llama3.2:3b'
const BASE_URL = '/api/generate'

/**
 * Generate text from prompt using local LLM
 */
export async function generate(
  prompt: string,
  options: Partial<LLMRequest> = {}
): Promise<string> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      model: options.model || DEFAULT_MODEL,
      maxTokens: options.maxTokens,
      temperature: options.temperature ?? 0.7,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    const error = data as LLMError
    throw new Error(error.message || 'LLM request failed')
  }

  return (data as LLMResponse).response
}

/**
 * Generate text with streaming
 */
export async function* generateStream(
  prompt: string,
  options: Partial<LLMRequest> = {}
): AsyncGenerator<string> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      model: options.model || DEFAULT_MODEL,
      stream: true,
    }),
  })

  if (!response.body) throw new Error('No response body')
  if (!response.ok) throw new Error('Stream request failed')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as { response?: string }
            if (parsed.response) yield parsed.response
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
