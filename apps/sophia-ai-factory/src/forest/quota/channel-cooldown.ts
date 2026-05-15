/**
 * channel-cooldown.ts — Per-channel cooldown + burst-protection enforcement.
 *
 * Two checks:
 *   1. Cooldown: time since last post to the same channel ≥ CHANNEL_COOLDOWN_SECONDS.
 *   2. Burst: posts to the same channel within last BURST_WINDOW_SECONDS < BURST_LIMIT_PER_HOUR.
 *
 * Query strategy (cheap — single D1 query each):
 *   - Cooldown: SELECT MAX(finished_at) FROM publishing_jobs WHERE channel_id=? AND status='live'
 *   - Burst: SELECT COUNT(*) FROM publishing_jobs WHERE channel_id=? AND status='live'
 *            AND finished_at >= now - BURST_WINDOW_SECONDS
 *
 * Both queries use only `publishing_jobs` which already has a (status, scheduled_at) index.
 * An index on (channel_id, status, finished_at) is added by migration 0102 if not present,
 * but the table is small enough that a scan is acceptable at current scale.
 *
 * On violation: returns deferred timestamp = lastPostAt + cooldown (caller schedules to that time).
 *
 * @module forest/quota/channel-cooldown
 */

import type { ChannelProvider } from '@/lib/publishing/publisher-interface';
import {
  CHANNEL_COOLDOWN_SECONDS,
  BURST_LIMIT_PER_HOUR,
  BURST_WINDOW_SECONDS,
} from '@/seed/config/channel-cooldown-rules';
import { logger } from '@/seed/utils/logger-utility';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CooldownViolationReason = 'cooldown' | 'burst';

export interface CooldownCheckResult {
  /** true = ok to post immediately */
  allowed: boolean;
  /** If not allowed: suggested Unix-second timestamp to retry/schedule */
  deferUntil?: number;
  /** Human-readable reason for deferral */
  reason?: CooldownViolationReason;
  /** Seconds until deferral timestamp (convenience) */
  deferSeconds?: number;
}

// ---------------------------------------------------------------------------
// D1 helper
// ---------------------------------------------------------------------------

async function tryGetRawDb(): Promise<D1Database | null> {
  try {
    const { getD1Raw } = await import('@/seed/db/client');
    return await getD1Raw();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback store (unit-test / dev)
// ---------------------------------------------------------------------------

interface MemRecord {
  finishedAt: number;
}

/** channelId → sorted list of recent post timestamps */
const memStore = new Map<string, MemRecord[]>();

function memKey(tenantId: string, channelId: string): string {
  return `${tenantId}:${channelId}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if a new post to `channelId`/`provider` is allowed now.
 *
 * @param tenantId   Tenant owning the channel
 * @param channelId  publishing_channels.id
 * @param provider   Channel provider enum
 * @param nowSeconds Current Unix time in seconds (injectable for tests)
 */
export async function checkCooldown(
  tenantId: string,
  channelId: string,
  provider: ChannelProvider,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<CooldownCheckResult> {
  const cooldownSecs = CHANNEL_COOLDOWN_SECONDS[provider];
  const burstWindow = nowSeconds - BURST_WINDOW_SECONDS;

  const db = await tryGetRawDb();

  if (db) {
    // Single query: get last post time AND burst count
    const row = await db
      .prepare(
        `SELECT
           MAX(finished_at) AS last_finished_at,
           SUM(CASE WHEN finished_at >= ? THEN 1 ELSE 0 END) AS burst_count
         FROM publishing_jobs
         WHERE tenant_id = ? AND channel_id = ? AND status = 'live'`,
      )
      .bind(burstWindow, tenantId, channelId)
      .first<{ last_finished_at: number | null; burst_count: number | null }>();

    const lastAt = row?.last_finished_at ?? null;
    const burstCount = row?.burst_count ?? 0;

    // Burst check first (more restrictive short-circuit)
    if (burstCount >= BURST_LIMIT_PER_HOUR) {
      // Defer until oldest post in burst window drops out
      // Approximate: defer until burstWindow expires from last-known oldest
      // Simple heuristic: deferUntil = nowSeconds + (remaining window / 2)
      const deferUntil = nowSeconds + Math.ceil(BURST_WINDOW_SECONDS / BURST_LIMIT_PER_HOUR);
      const deferSeconds = deferUntil - nowSeconds;
      logger.warn('[ChannelCooldown] Burst limit reached', {
        tenantId, channelId, provider, burstCount, deferUntil,
      });
      return { allowed: false, deferUntil, reason: 'burst', deferSeconds };
    }

    // Cooldown check
    if (lastAt !== null && nowSeconds - lastAt < cooldownSecs) {
      const deferUntil = lastAt + cooldownSecs;
      const deferSeconds = deferUntil - nowSeconds;
      logger.warn('[ChannelCooldown] Cooldown not elapsed', {
        tenantId, channelId, provider, lastAt, cooldownSecs, deferUntil,
      });
      return { allowed: false, deferUntil, reason: 'cooldown', deferSeconds };
    }

    return { allowed: true };
  }

  // -------------------------------------------------------------------------
  // In-memory fallback
  // -------------------------------------------------------------------------
  const key = memKey(tenantId, channelId);
  const records = memStore.get(key) ?? [];
  const recent = records.filter((r) => r.finishedAt >= burstWindow);

  if (recent.length >= BURST_LIMIT_PER_HOUR) {
    const deferUntil = nowSeconds + Math.ceil(BURST_WINDOW_SECONDS / BURST_LIMIT_PER_HOUR);
    return { allowed: false, deferUntil, reason: 'burst', deferSeconds: deferUntil - nowSeconds };
  }

  const lastAt = records.length > 0 ? Math.max(...records.map((r) => r.finishedAt)) : null;
  if (lastAt !== null && nowSeconds - lastAt < cooldownSecs) {
    const deferUntil = lastAt + cooldownSecs;
    return { allowed: false, deferUntil, reason: 'cooldown', deferSeconds: deferUntil - nowSeconds };
  }

  return { allowed: true };
}

/**
 * Record a successful post (used by Inngest handler after status='live').
 * Updates in-memory fallback only — D1 is source of truth via publishing_jobs.
 *
 * Callers using D1 do NOT need to call this — checkCooldown queries D1 directly.
 * This exists for the in-memory dev/test fallback path.
 *
 * @param tenantId   Tenant owning the channel
 * @param channelId  publishing_channels.id
 * @param publishedAt Unix seconds of publish completion
 */
export function recordPostInMemory(
  tenantId: string,
  channelId: string,
  publishedAt: number = Math.floor(Date.now() / 1000),
): void {
  const key = memKey(tenantId, channelId);
  const records = memStore.get(key) ?? [];
  records.push({ finishedAt: publishedAt });
  // Keep only last 24 h to bound memory
  const cutoff = publishedAt - 86400;
  memStore.set(key, records.filter((r) => r.finishedAt >= cutoff));
}

/**
 * Reset in-memory store (for tests).
 */
export function _resetMemStoreForTests(): void {
  memStore.clear();
}
