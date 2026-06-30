/**
 * Anthropic API Adapter — Phase 4J + 4L + 4N
 *
 * Thin wrapper around https://api.anthropic.com/v1/messages.
 * Uses plain fetch (Cloudflare Workers compatible — no SDK).
 *
 * Exports:
 *   - callAnthropic:             simple text-only call, returns first text block.
 *   - callAnthropicFull:         returns full response (for tool-use + multi-block).
 *   - callAnthropicStream:       SSE streaming, yields text_delta chunks (string).
 *   - callAnthropicStreamEvents: SSE streaming, yields structured events (tool-use capable).
 */

import {
  parseAnthropicSse,
  type AnthropicStreamEvent,
} from './anthropic-sse-parser'
import { ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/seed/services/errors'
import { logger } from '@/seed/utils/logger-utility'

export type { AnthropicStreamEvent } from './anthropic-sse-parser'

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
const API_URL             = 'https://api.anthropic.com/v1/messages'
const API_VERSION         = '2023-06-01'
const ERROR_BODY_MAX_LEN  = 500   // Phase 4N L-1: truncate upstream body echoes

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
  const raw = await response.text().catch((err) => {
    logger.warn('Failed to read Anthropic error response body', {
      error: String(err),
      context: 'httpError',
    });
    return '';
  })
  const body = raw.length > ERROR_BODY_MAX_LEN
    ? `${raw.slice(0, ERROR_BODY_MAX_LEN)}...[truncated]`
    : raw
  if (response.status === 401 || response.status === 403) {
    throw new ProviderInvalidKeyError('anthropic', body)
  }
  if (response.status === 429 || response.status === 402) {
    throw new ProviderQuotaExceededError('anthropic', body)
  }
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

// ── Streaming: yields structured events (text + tool_use) ────────────────────

export async function* callAnthropicStreamEvents(
  params: CallAnthropicParams,
): AsyncGenerator<AnthropicStreamEvent, void, unknown> {
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

  const reader = response.body.getReader()
  yield* parseAnthropicSse(reader)
}

// ── Streaming (text-only convenience): yields text_delta strings ────────────

export async function* callAnthropicStream(
  params: CallAnthropicParams,
): AsyncGenerator<string, void, unknown> {
  for await (const event of callAnthropicStreamEvents(params)) {
    if (event.type === 'text_delta') yield event.text
  }
}
