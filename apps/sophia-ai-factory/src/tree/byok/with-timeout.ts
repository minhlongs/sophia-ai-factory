/**
 * BYOK Timeout Guard Wrapper
 *
 * Drop-in replacement for fetch() for outbound BYOK provider calls.
 * Enforces a hard timeout (default 25s — 5s headroom under 30s edge limit),
 * aborts the in-flight request, and emits exactly ONE D1 signal per call:
 *   - success  → byok_call  { provider, status_code, latency_ms }
 *   - timeout  → byok_timeout { provider, timeout_ms }
 *   - error    → byok_call  { provider, status_code: 0, latency_ms, error_class }
 *
 * SECURITY: never logs request body or auth headers — track props are
 * limited to provider, status codes, and latency (no key material).
 */

import { track } from '@/tree/signals'
import { D1Events } from '@/tree/signals'

// ── Error class ───────────────────────────────────────────────────────────────

/**
 * Thrown by withTimeout() when a BYOK provider call exceeds the timeout.
 * Extends Error so existing try/catch blocks in adapters catch it transparently.
 */
export class BYOKTimeoutError extends Error {
  readonly name = 'BYOKTimeoutError'

  constructor(
    /** Provider name, e.g. 'elevenlabs' | 'openrouter' | 'd-id' */
    public readonly provider: string,
    /** Timeout threshold that was exceeded, in milliseconds */
    public readonly timeoutMs: number,
  ) {
    super(`BYOK ${provider} timed out after ${timeoutMs}ms`)
    // Restore prototype chain for instanceof checks across transpiled code
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ── Init interface ────────────────────────────────────────────────────────────

/** RequestInit extended with timeout + provider metadata for signal emission */
export interface WithTimeoutInit extends RequestInit {
  /**
   * Abort timeout in milliseconds.
   * Default: 25_000 (5s headroom under 30s Cloudflare Workers edge limit)
   */
  timeoutMs?: number
  /** BYOK provider identifier — emitted in signal props, no key material */
  provider: string
}

// ── Wrapper ───────────────────────────────────────────────────────────────────

/**
 * Fetch wrapper with hard timeout + automatic D1 signal emission.
 *
 * Emits exactly ONE signal per call:
 *   - On success: `byok_call` with status_code + latency_ms
 *   - On timeout: `byok_timeout` with provider + timeout_ms, then throws BYOKTimeoutError
 *   - On other error: `byok_call` with status_code=0 + error_class, then re-throws
 *
 * @param input    URL string or Request — passed through to fetch()
 * @param init     Extended RequestInit with required `provider` and optional `timeoutMs`
 * @returns        Unmodified Response from upstream provider
 * @throws         BYOKTimeoutError on timeout; original error on other network/fetch failures
 */
export async function withTimeout(
  input: RequestInfo,
  init: WithTimeoutInit,
): Promise<Response> {
  const { timeoutMs = 25_000, provider, ...rest } = init

  // Edge-safe AbortController (Workers spec compliant — no polyfill needed)
  const controller = new (globalThis.AbortController)()
  const t0 = Date.now()

  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(input, { ...rest, signal: controller.signal })

    // Success path — emit byok_call with HTTP status + latency
    track(D1Events.BYOK_CALL, 'system', {
      provider,
      status_code: res.status,
      latency_ms: Date.now() - t0,
    })

    return res
  } catch (err) {
    if (controller.signal.aborted) {
      // Timeout path — emit byok_timeout, throw typed error
      track(D1Events.BYOK_TIMEOUT, 'system', {
        provider,
        timeout_ms: timeoutMs,
      })
      throw new BYOKTimeoutError(provider, timeoutMs)
    }

    // Non-timeout error path — emit byok_call with error metadata, re-throw original
    track(D1Events.BYOK_CALL, 'system', {
      provider,
      status_code: 0,
      latency_ms: Date.now() - t0,
      error_class: err instanceof Error ? err.name : 'Error',
    })
    throw err
  } finally {
    clearTimeout(timer)
  }
}
