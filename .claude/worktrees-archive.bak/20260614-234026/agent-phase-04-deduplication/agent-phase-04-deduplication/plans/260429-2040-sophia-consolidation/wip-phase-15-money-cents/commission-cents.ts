/**
 * Commission Cents — Integer arithmetic helpers for money math
 *
 * All money stored as INTEGER cents to avoid floating-point drift.
 * $1.00 → 100 cents. Use toCents/fromCents at system boundaries.
 *
 * @module payouts/commission-cents
 */

/** Convert USD float to integer cents (round half-up). */
export function toCents(usd: number): number {
  return Math.round(usd * 100)
}

/** Convert integer cents back to USD float. */
export function fromCents(cents: number): number {
  return cents / 100
}

/** Sanitise NOWPayments error strings — strips addresses, keys, tokens. */
const SANITIZE_RE =
  /T[A-Za-z0-9]{33}|0x[A-Fa-f0-9]{40}|Bearer\s+\S+|x-api-key:\s*\S+/gi

export function sanitizeErrorText(s: string): string {
  return s.replace(SANITIZE_RE, '[REDACTED]').slice(0, 500)
}

/**
 * Deterministic batch ID: sha256(tenant|affiliate|isoWeek).
 * isoWeek = YYYY-WNN computed from a Date.
 * Stable within a calendar week — re-running batcher same week is idempotent.
 */
export async function deterministicBatchId(
  tenantId: string,
  affiliateId: string,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getUTCFullYear()
  // ISO week number
  const startOfYear = new Date(Date.UTC(year, 0, 1))
  const dayOfYear =
    Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000) + 1
  const weekNum = Math.ceil(dayOfYear / 7)
  const isoWeek = `${year}-W${String(weekNum).padStart(2, '0')}`
  const raw = `${tenantId}|${affiliateId}|${isoWeek}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `batch_${hex.slice(0, 16)}`
}
