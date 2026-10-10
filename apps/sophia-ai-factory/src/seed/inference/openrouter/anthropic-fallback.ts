import { logger } from '@/seed/utils/logger-utility'

export async function callAnthropicFallback(
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
  })

  if (!res.ok) {
    const errorBody = await res.text().catch((err) => {
      logger.warn('Failed to read Anthropic error response', {
        error: String(err),
        context: 'callAnthropicFallback',
      })
      return ''
    })
    throw new Error(`Anthropic HTTP ${res.status}: ${errorBody.slice(0, 200)}`)
  }

  const data = (await res.json()) as { content?: { text?: string }[] }
  return data.content?.[0]?.text ?? ''
}
