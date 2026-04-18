/**
 * Anthropic API Adapter — Phase 4J
 *
 * Thin wrapper around https://api.anthropic.com/v1/messages.
 * Uses plain fetch (Cloudflare Workers compatible — no SDK).
 * No streaming — sync-per-tick cron usage only.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnthropicMessage {
  role:    'user' | 'assistant'
  content: string
}

interface AnthropicContentBlock {
  type: string
  text: string
}

export interface AnthropicResponse {
  id:      string
  type:    string
  role:    string
  content: AnthropicContentBlock[]
  model:   string
  stop_reason:    string | null
  stop_sequence:  string | null
  usage: {
    input_tokens:  number
    output_tokens: number
  }
}

export interface CallAnthropicParams {
  model:    string
  messages: AnthropicMessage[]
  apiKey:   string
}

// ── Adapter ───────────────────────────────────────────────────────────────────

/**
 * Call Anthropic Messages API and return the first text content block.
 *
 * @throws {Error} on missing apiKey, non-2xx HTTP status, or empty content
 */
export async function callAnthropic({
  model,
  messages,
  apiKey,
}: CallAnthropicParams): Promise<string> {
  if (!apiKey) {
    throw new Error('ANTHROPIC_MISSING_API_KEY: apiKey is required')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`ANTHROPIC_HTTP_${response.status}: ${body}`)
  }

  const data = await response.json() as AnthropicResponse

  const text = data.content?.[0]?.text
  if (!text) {
    throw new Error('ANTHROPIC_EMPTY_RESPONSE: content array is empty or missing text')
  }

  return text
}
