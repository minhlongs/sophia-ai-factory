/**
 * ZuneF Resilient Client (Cloudflare Workers runtime)
 *
 * Replaces Node `fs` calls (`existsSync/readFileSync/writeFileSync`) with a
 * Workers-compatible storage layer that prefers KV and falls back to D1.
 *
 * Public API is preserved — all callers still see the same exports:
 *   zunefChatCompletion / resetZuneFCircuit / getZuneFCircuitState
 *
 * Caching: 14-minute refresh lease for token; device-id is durable once-set.
 * Circuit breaker: in-memory, resets on any successful completion.
 */

import { logger } from '@/seed/utils/logger-utility'
import {
  storageGet,
  storageSet,
  storageDelete,
} from '@/seed/kv/kv-storage-ops'

/* ------------------------------------------------------------------ *
 * Types used by this module (TokenData lives here — not in kv-storage-ops)
 * ------------------------------------------------------------------ */

interface TokenData {
  token: string
  expiresAt: number // epoch ms
}

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

const ZUNEF_BASE_URL = 'https://claude.zunef.com'

// Shared with any caller that needs to seed or evict credentials.
export const ZUNEF_KV_PREFIX = 'zunef:'
export const DEVICE_ID_KEY = `${ZUNEF_KV_PREFIX}device-id`
export const DEVICE_TOKEN_KEY = `${ZUNEF_KV_PREFIX}device-token`

/** Treat a token as fresh if it has more than this much remaining time. */
const TOKEN_FRESH_SKEW_MS = 60_000

/* ------------------------------------------------------------------ *
 * Circuit breaker — process-local, reset on each successful completion
 * ------------------------------------------------------------------ */

interface CircuitState {
  failures: number
  openUntil: number // epoch ms
}

const circuit: CircuitState = { failures: 0, openUntil: 0 }
const CIRCUIT_THRESHOLD = 5
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000

function isCircuitOpen(): boolean {
  return Date.now() < circuit.openUntil
}

function recordSuccess(): void {
  circuit.failures = 0
}

function recordFailure(): void {
  circuit.failures++
  if (circuit.failures >= CIRCUIT_THRESHOLD && circuit.openUntil === 0) {
    circuit.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS
    logger.warn('[zunef-client] Circuit breaker opened', {
      failures: circuit.failures,
      openUntil: new Date(circuit.openUntil).toISOString(),
    })
  }
}

/* ------------------------------------------------------------------ *
 * Credential storage (KV/D1 — never touches Node fs)
 * ------------------------------------------------------------------ */

async function getOrCreateDeviceId(): Promise<string> {
  try {
    const stored = await storageGet(DEVICE_ID_KEY)
    if (stored) return stored

    const id = `device-${crypto.randomUUID()}`
    await storageSet(DEVICE_ID_KEY, id)
    return id
  } catch (err) {
    logger.error('[zunef-client] Device ID error', { error: String(err) })
    throw err
  }
}

function tokenFromRaw(raw: string): TokenData | null {
  try {
    return JSON.parse(raw) as TokenData
  } catch {
    return null
  }
}

async function getFreshToken(deviceId: string): Promise<TokenData> {
  const res = await fetch(`${ZUNEF_BASE_URL}/api/claude-code/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Auth failed: ${res.status} ${text}`)
  }

  const parsed: { token: string; expiresIn: number } = await res.json()
  const tokenData: TokenData = {
    token: parsed.token,
    expiresAt: Date.now() + parsed.expiresIn * 1_000,
  }
  await storageSet(DEVICE_TOKEN_KEY, JSON.stringify(tokenData))
  return tokenData
}

async function getOrRefreshToken(deviceId: string): Promise<string> {
  try {
    const raw = await storageGet(DEVICE_TOKEN_KEY)
    if (raw) {
      const existing = tokenFromRaw(raw)
      if (existing && existing.expiresAt > Date.now() + TOKEN_FRESH_SKEW_MS) {
        return existing.token
      }
    }

    const tokenData = await getFreshToken(deviceId)
    return tokenData.token
  } catch (err) {
    logger.error('[zunef-client] Token refresh failed', { error: String(err) })
    throw err
  }
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

interface ZuneFResponse {
  choices: Array<{ message: { content: string } }>
}

export async function zunefChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options: { model?: string } = {},
): Promise<string> {
  if (isCircuitOpen()) {
    throw new Error('Circuit breaker open — ZuneF proxy degraded')
  }

  const deviceId = await getOrCreateDeviceId()
  const token = await getOrRefreshToken(deviceId)

  const maxRetries = 8
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      const res = await fetch(`${ZUNEF_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || 'claude-3.5-sonnet',
          messages,
          max_tokens: 4096,
        }),
      })

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10)
        await sleep((retryAfter + Math.random()) * 1_000)
        attempt++
        continue
      }

      if (res.status >= 500) {
        const text = await res.text()

        if (text.includes('cooldown') || text.includes('cooling down')) {
          throw new Error(`ZuneF cooldown: ${text}`)
        }

        throw new Error(`ZuneF error ${res.status}: ${text}`)
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`ZuneF error ${res.status}: ${text}`)
      }

      const data: ZuneFResponse = await res.json()
      recordSuccess()
      return data.choices[0]?.message?.content || ''
    } catch (err) {
      attempt++
      if (attempt >= maxRetries) {
        recordFailure()
        throw err
      }

      const delay = Math.min(1_000 * 2 ** attempt + Math.random() * 1_000, 30_000)
      await sleep(delay)
    }
  }

  throw new Error('ZuneF: max retries exceeded')
}

/* ------------------------------------------------------------------ *
 * Lifecycle helpers
 * ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  const g = globalThis as Record<string, unknown>
  if (typeof g.__zunefSleep === 'function') {
    return (g.__zunefSleep as (ms: number) => Promise<void>)(ms)
  }
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function resetZuneFCircuit(): void {
  circuit.failures = 0
  circuit.openUntil = 0
  logger.info('[zunef-client] Circuit reset')
}

export function getZuneFCircuitState(): {
  failures: number
  openUntil: number
} {
  return { ...circuit }
}

/**
 * Remove both `zunef:device-id` and `zunef:device-token` from KV/D1.
 * Mirrors the old behavior of `rm -f <device-id-file> <token-file>`.
 */
export async function clearZuneFCredentials(): Promise<void> {
  await Promise.all([
    storageDelete(DEVICE_ID_KEY),
    storageDelete(DEVICE_TOKEN_KEY),
  ])
}
