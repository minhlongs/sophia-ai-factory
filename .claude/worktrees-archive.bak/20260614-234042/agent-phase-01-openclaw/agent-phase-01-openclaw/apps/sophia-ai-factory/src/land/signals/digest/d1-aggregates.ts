/**
 * D1 Aggregate Query Functions — Weekly Metrics Digest
 *
 * Five typed query functions that read from signals_events for the last 7 days.
 * Each fn is pure (takes db + windowMs as args) → testable without globalThis.
 *
 * D1 note: TEXT props_json — use json_extract() for SQLite JSON queries.
 * SECURITY: returns aggregate counts only — no user IDs, no raw props.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SignupStats {
  /** Count of tier_conversion events where props had from_tier='free'/'BASIC' */
  count: number
}

export interface ConversionRow {
  to_tier: string
  count: number
}

export interface PaymentStats {
  success_count: number
  failed_count: number
  total_usd: number
}

export interface ByokProviderRow {
  provider: string
  call_count: number
}

export interface AgentDispatchRow {
  /** campaign_id used as proxy for agent name in dispatch events */
  command: string
  dispatch_count: number
}

// ── Internal helper ───────────────────────────────────────────────────────────

/** Returns unix ms timestamp for `daysAgo` days before now */
function windowStart(daysAgo = 7): number {
  return Date.now() - daysAgo * 24 * 60 * 60 * 1000
}

/** Safely parse integer from D1 result (may come as string or number) */
function toInt(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  if (typeof v === 'string') return parseInt(v, 10) || 0
  return 0
}

/** Safely parse float from D1 result */
function toFloat(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v) || 0
  return 0
}

// ── Query 1: New signups ──────────────────────────────────────────────────────

/**
 * Count tier_conversion events in last 7 days where from_tier is a free/entry tier.
 * This approximates "new paying users" who upgraded from free.
 */
export async function querySignupStats(
  db: D1Database,
  windowMs = windowStart(),
): Promise<SignupStats> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM signals_events
       WHERE event_type = 'tier_conversion'
         AND ts >= ?
         AND (
           json_extract(props_json, '$.from_tier') = 'free'
           OR json_extract(props_json, '$.from_tier') = 'BASIC'
         )`,
    )
    .bind(windowMs)
    .first<{ count: number | string }>()

  return { count: toInt(row?.count) }
}

// ── Query 2: Tier conversions ─────────────────────────────────────────────────

/**
 * Group tier_conversion events by to_tier in last 7 days.
 * Returns array sorted by count desc.
 */
export async function queryConversionsByTier(
  db: D1Database,
  windowMs = windowStart(),
): Promise<ConversionRow[]> {
  const result = await db
    .prepare(
      `SELECT json_extract(props_json, '$.to_tier') AS to_tier, COUNT(*) AS count
       FROM signals_events
       WHERE event_type = 'tier_conversion'
         AND ts >= ?
       GROUP BY json_extract(props_json, '$.to_tier')
       ORDER BY count DESC
       LIMIT 20`,
    )
    .bind(windowMs)
    .all<{ to_tier: string | null; count: number | string }>()

  return (result.results ?? [])
    .filter((r) => r.to_tier != null)
    .map((r) => ({ to_tier: String(r.to_tier), count: toInt(r.count) }))
}

// ── Query 3: Payment success / failure ────────────────────────────────────────

/**
 * Aggregate payment_success and payment_failed events in last 7 days.
 * Returns total success count, failure count, and sum of USD from success events.
 */
export async function queryPaymentStats(
  db: D1Database,
  windowMs = windowStart(),
): Promise<PaymentStats> {
  const successRow = await db
    .prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(CAST(json_extract(props_json, '$.amount_usd') AS REAL)), 0) AS total
       FROM signals_events
       WHERE event_type = 'payment_success'
         AND ts >= ?`,
    )
    .bind(windowMs)
    .first<{ cnt: number | string; total: number | string }>()

  const failedRow = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM signals_events
       WHERE event_type = 'payment_failed'
         AND ts >= ?`,
    )
    .bind(windowMs)
    .first<{ cnt: number | string }>()

  return {
    success_count: toInt(successRow?.cnt),
    failed_count: toInt(failedRow?.cnt),
    total_usd: toFloat(successRow?.total),
  }
}

// ── Query 4: Top BYOK providers ───────────────────────────────────────────────

/**
 * Group byok_call events by provider in last 7 days.
 * Returns top providers sorted by call count desc (max 10).
 */
export async function queryTopByokProviders(
  db: D1Database,
  windowMs = windowStart(),
): Promise<ByokProviderRow[]> {
  const result = await db
    .prepare(
      `SELECT json_extract(props_json, '$.provider') AS provider, COUNT(*) AS call_count
       FROM signals_events
       WHERE event_type = 'byok_call'
         AND ts >= ?
       GROUP BY json_extract(props_json, '$.provider')
       ORDER BY call_count DESC
       LIMIT 10`,
    )
    .bind(windowMs)
    .all<{ provider: string | null; call_count: number | string }>()

  return (result.results ?? [])
    .filter((r) => r.provider != null)
    .map((r) => ({ provider: String(r.provider), call_count: toInt(r.call_count) }))
}

// ── Query 5: Agent dispatch counts ───────────────────────────────────────────

/**
 * Group agent_dispatch events by command (or campaign_id fallback) in last 7 days.
 * Returns top dispatch entries sorted by count desc (max 10).
 */
export async function queryAgentDispatches(
  db: D1Database,
  windowMs = windowStart(),
): Promise<AgentDispatchRow[]> {
  const result = await db
    .prepare(
      `SELECT
         COALESCE(json_extract(props_json, '$.command'), json_extract(props_json, '$.campaign_id'), 'unknown') AS command,
         SUM(COALESCE(CAST(json_extract(props_json, '$.channel_count') AS INTEGER), 1)) AS dispatch_count
       FROM signals_events
       WHERE event_type = 'agent_dispatch'
         AND ts >= ?
       GROUP BY command
       ORDER BY dispatch_count DESC
       LIMIT 10`,
    )
    .bind(windowMs)
    .all<{ command: string | null; dispatch_count: number | string }>()

  return (result.results ?? [])
    .map((r) => ({ command: String(r.command ?? 'unknown'), dispatch_count: toInt(r.dispatch_count) }))
}
