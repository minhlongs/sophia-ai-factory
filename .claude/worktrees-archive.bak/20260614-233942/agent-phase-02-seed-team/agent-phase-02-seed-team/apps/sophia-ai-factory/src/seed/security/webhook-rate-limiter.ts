/**
 * In-memory sliding window rate limiter for webhook endpoints.
 *
 * Provides per-isolate protection against rapid retry storms.
 * Cloudflare Workers don't share memory across isolates, but this
 * limits requests within a single isolate to prevent self-DoS.
 */

const WINDOW_MS = 60_000
const MAX_REQUESTS = 20

const windows = new Map<string, { count: number; resetAt: number }>()

export function checkWebhookRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = windows.get(key)

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) return false
  return true
}

// Periodic cleanup to prevent memory leak from stale entries
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) windows.delete(key)
  }
}, WINDOW_MS)
