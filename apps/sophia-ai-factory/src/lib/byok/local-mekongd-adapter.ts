/**
 * Local mekongd Adapter — Phase A "Eat-Own-Dogfood"
 *
 * Routes a single LLM call to a local mekongd daemon (Anthropic-compat
 * `/v1/messages`) reachable via Cloudflare Tunnel from a Cloudflare Worker.
 *
 * Founder runs Qwen 3.6-35B-A3B on M1 Max via mekongd; this adapter lets
 * the prod Sophia Worker route inference there instead of OpenRouter.
 *
 * Returns the assistant text on success, `null` on any failure (caller
 * decides whether to fall back to a cloud provider). Reuses `withTimeout`
 * so we get the same `byok_call` / `byok_timeout` D1 signals for free.
 *
 * SECURITY: bearer token (if configured) goes only in the Authorization
 * header — never logged. Endpoint URL must be a CF Worker secret, NOT a
 * `[vars]` entry in `wrangler.toml`.
 */

import { withTimeout } from '@/lib/byok/with-timeout'

/** Anthropic-compat response shape returned by mekongd */
interface MekongdMessageResponse {
  content?: Array<{ type: string; text: string }>
}

export interface CallLocalMekongdOptions {
  /** Base URL of the mekongd tunnel, e.g. `https://mekongd.cashclaw.cc` */
  endpoint: string
  /** Optional bearer token for tunnel-level auth (CF Access etc.) */
  bearer?: string
  /** Override the model id — defaults to Qwen 3.6-35B-A3B */
  model?: string
  /** Override max output tokens (default 10 — niche-score is a number) */
  maxTokens?: number
}

/**
 * Send a single user-prompt to local mekongd. Returns the assistant text
 * on HTTP 200 or `null` on any failure (timeout, non-2xx, bad shape, etc.).
 *
 * Caller is responsible for: prompt construction, response parsing
 * (e.g. parseInt), and fallback routing on `null`.
 */
export async function callLocalMekongd(
  prompt: string,
  opts: CallLocalMekongdOptions,
): Promise<string | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`

  try {
    const res = await withTimeout(`${opts.endpoint.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: opts.model ?? 'Qwen/Qwen3.6-35B-A3B',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxTokens ?? 10,
        stream: false,
      }),
      provider: 'local-mekongd',
      timeoutMs: 25_000,
    })

    if (!res.ok) return null

    const data = (await res.json()) as MekongdMessageResponse
    const text = data.content?.[0]?.text?.trim()
    return text && text.length > 0 ? text : null
  } catch {
    return null
  }
}
