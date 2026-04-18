/**
 * Anthropic API Adapter — Phase 4J + 4L
 *
 * Thin wrapper around https://api.anthropic.com/v1/messages.
 * Uses plain fetch (Cloudflare Workers compatible — no SDK).
 *
 * Exports:
 *   - callAnthropic:       simple text-only call, returns first text block.
 *   - callAnthropicFull:   returns full response (for tool-use + multi-block).
 *   - callAnthropicStream: SSE streaming, yields text_delta chunks.
 */

// ── Message & content types ──────────────────────────────────────────────────

export interface AnthropicMessage {
  role:    'user' | 'assistant'
  content: string
}

export interface AnthropicTextBlock {
  type: 'text'
  text: string
}

export interface AnthropicToolUseBlock {
  type:  'tool_use'
  id:    string
  name:  string
  input: Record<string, unknown>
}

export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock

export interface AnthropicTool {
  name:         string
  description?: string
  input_schema: Record<string, unknown>
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
  model:      string
  messages:   AnthropicMessage[]
  apiKey:     string
  maxTokens?: number   // default 1024
  tools?:     AnthropicTool[]
  system?:    string
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 1024
const API_URL     = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key':         apiKey,
    'anthropic-version': API_VERSION,
    'content-type':      'application/json',
  }
}

function buildBody(params: CallAnthropicParams, stream: boolean): string {
  const body: Record<string, unknown> = {
    model:      params.model,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages:   params.messages,
  }
  if (params.system) body.system = params.system
  if (params.tools && params.tools.length > 0) body.tools = params.tools
  if (stream) body.stream = true
  return JSON.stringify(body)
}

async function httpError(response: Response): Promise<never> {
  const body = await response.text().catch(() => '')
  throw new Error(`ANTHROPIC_HTTP_${response.status}: ${body}`)
}

// ── Full call: returns full response (for tool-use + multi-block) ───────────

export async function callAnthropicFull(params: CallAnthropicParams): Promise<AnthropicResponse> {
  if (!params.apiKey) {
    throw new Error('ANTHROPIC_MISSING_API_KEY: apiKey is required')
  }

  const response = await fetch(API_URL, {
    method:  'POST',
    headers: buildHeaders(params.apiKey),
    body:    buildBody(params, false),
  })

  if (!response.ok) await httpError(response)

  const data = await response.json() as AnthropicResponse
  if (!data.content || data.content.length === 0) {
    throw new Error('ANTHROPIC_EMPTY_RESPONSE: content array is empty')
  }
  return data
}

// ── Simple call: returns first text block ────────────────────────────────────

export async function callAnthropic(params: CallAnthropicParams): Promise<string> {
  const data = await callAnthropicFull(params)
  const firstText = data.content.find(
    (b): b is AnthropicTextBlock => b.type === 'text',
  )?.text
  if (!firstText) {
    throw new Error('ANTHROPIC_EMPTY_RESPONSE: content array has no text block')
  }
  return firstText
}

// ── Streaming: yields text_delta chunks from SSE stream ─────────────────────

interface SseDeltaEvent {
  type?:  string
  delta?: { type?: string; text?: string }
}

export async function* callAnthropicStream(
  params: CallAnthropicParams,
): AsyncGenerator<string, void, unknown> {
  if (!params.apiKey) {
    throw new Error('ANTHROPIC_MISSING_API_KEY: apiKey is required')
  }

  const response = await fetch(API_URL, {
    method:  'POST',
    headers: buildHeaders(params.apiKey),
    body:    buildBody(params, true),
  })

  if (!response.ok) await httpError(response)
  if (!response.body) {
    throw new Error('ANTHROPIC_NO_STREAM_BODY: response body is null')
  }

  const reader  = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let eolIndex: number
    while ((eolIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, eolIndex).trim()
      buffer = buffer.slice(eolIndex + 1)
      if (!line.startsWith('data:')) continue

      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue

      try {
        const event = JSON.parse(payload) as SseDeltaEvent
        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta' &&
          event.delta.text
        ) {
          yield event.delta.text
        }
      } catch {
        // skip malformed SSE payloads
      }
    }
  }
}
