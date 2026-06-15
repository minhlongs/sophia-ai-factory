/**
 * Tier Change Provisioner — atomic D1 tier switch with pro-rata credit calculation.
 *
 * Handles upgrade/downgrade between BASIC/PREMIUM/ENTERPRISE.
 * MASTER requires separate payment flow (lifetime one-time).
 *
 * @module land/billing/tier-change-provisioner
 */

import { getD1 } from '@/seed/db/client'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import { logger } from '@/seed/utils/logger-utility'
import type { Tier } from '@/seed/types'

const TIER_RANK: Record<string, number> = {
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
  MASTER: 4,
}

export interface ProvisionResult {
  success: boolean
  error?: string
  creditCents?: number
  effectiveAt?: string
}

interface SubscriptionRow {
  id: string
  org_id: string
  plan: string
  status: string
  current_period_start: string
  current_period_end: string
}

/**
 * Calculate pro-rata credit for unused days on current tier.
 * Returns credit in USD cents.
 */
export function calculateProRataCredit(
  currentTierPrice: number,
  periodStart: string,
  periodEnd: string,
): number {
  const start = new Date(periodStart).getTime()
  const end = new Date(periodEnd).getTime()
  const now = Date.now()

  if (now >= end || now <= start) return 0

  const totalMs = end - start
  const usedMs = now - start
  const remainingRatio = 1 - usedMs / totalMs

  return Math.max(0, Math.round(currentTierPrice * remainingRatio))
}

/**
 * Provision a tier change atomically in D1.
 *
 * For immediate changes:
 *   1. Calculate pro-rata credit from remaining days
 *   2. Update subscriptions.plan + organizations.plan
 *   3. Insert tier_change_events audit row
 *   4. Store credit in user_profiles settings for future invoice offset
 *
 * For end-of-cycle:
 *   1. Store pending change in user_profiles settings (existing behavior)
 *   2. Insert tier_change_events with event_type='downgrade' or 'upgrade'
 *   3. Cron or expiry handler picks it up at period end
 */
export async function provisionTierChange(params: {
  userId: string
  orgId: string
  currentTier: Tier
  targetTier: Tier
  timing: 'immediate' | 'end_of_cycle'
}): Promise<ProvisionResult> {
  const { userId, orgId, currentTier, targetTier, timing } = params
  const isDowngrade = TIER_RANK[targetTier] < TIER_RANK[currentTier]
  const eventType = isDowngrade ? 'downgrade' : 'upgrade'

  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const sub = await db
    .prepare('SELECT id, org_id, plan, status, current_period_start, current_period_end FROM subscriptions WHERE org_id = ?1 LIMIT 1')
    .bind(orgId)
    .first<SubscriptionRow>()

  if (!sub) {
    return { success: false, error: 'no_active_subscription' }
  }

  if (sub.status !== 'active') {
    return { success: false, error: 'subscription_not_active' }
  }

  const now = new Date().toISOString()

  if (timing === 'end_of_cycle') {
    // Store pending change — cron/expiry handler provisions at period end
    const settingsRow = await db
      .prepare('SELECT settings FROM user_profiles WHERE user_id = ?1')
      .bind(userId)
      .first<{ settings: string | null }>()

    let settings: Record<string, unknown> = {}
    try {
      if (settingsRow?.settings) settings = JSON.parse(settingsRow.settings) as Record<string, unknown>
    } catch { /* ignore */ }

    settings.tier_change_request = {
      target_tier: targetTier,
      timing: 'end_of_cycle',
      requested_at: Math.floor(Date.now() / 1000),
      from_tier: currentTier,
    }

    await db.batch([
      db.prepare('UPDATE user_profiles SET settings = ?1, updated_at = ?2 WHERE user_id = ?3')
        .bind(JSON.stringify(settings), now, userId),
      db.prepare(
        `INSERT INTO tier_change_events (user_id, org_id, from_tier, to_tier, event_type)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      ).bind(userId, orgId, currentTier, targetTier, `pending_${eventType}`),
    ])

    logger.info('[TierProvisioner] End-of-cycle change scheduled', { userId, currentTier, targetTier })
    return { success: true, effectiveAt: sub.current_period_end }
  }

  // ── Immediate provisioning ──────────────────────────────────────────────────

  let creditCents = 0
  if (isDowngrade) {
    const currentPrice = UNIFIED_TIERS[currentTier].priceInCents
    creditCents = calculateProRataCredit(currentPrice, sub.current_period_start, sub.current_period_end)
  }

  // New period: 30 days from now for the new tier
  const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Store credit in user_profiles settings if downgrade
  let settingsUpdate: string | null = null
  if (creditCents > 0) {
    const settingsRow = await db
      .prepare('SELECT settings FROM user_profiles WHERE user_id = ?1')
      .bind(userId)
      .first<{ settings: string | null }>()

    let settings: Record<string, unknown> = {}
    try {
      if (settingsRow?.settings) settings = JSON.parse(settingsRow.settings) as Record<string, unknown>
    } catch { /* ignore */ }

    const existingCredit = (settings.account_credit_cents as number) ?? 0
    settings.account_credit_cents = existingCredit + creditCents
    settings.last_credit_reason = `pro_rata_downgrade_${currentTier}_to_${targetTier}`
    settings.last_credit_at = Math.floor(Date.now() / 1000)
    delete settings.tier_change_request
    settingsUpdate = JSON.stringify(settings)
  }

  const stmts = [
    db.prepare('UPDATE subscriptions SET plan = ?1, current_period_start = ?2, current_period_end = ?3, updated_at = ?4 WHERE org_id = ?5')
      .bind(targetTier.toLowerCase(), now, newPeriodEnd, now, orgId),
    db.prepare('UPDATE organizations SET plan = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(targetTier.toLowerCase(), now, orgId),
    db.prepare(
      `INSERT INTO tier_change_events (user_id, org_id, from_tier, to_tier, event_type)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    ).bind(userId, orgId, currentTier, targetTier, eventType),
  ]

  if (settingsUpdate) {
    stmts.push(
      db.prepare('UPDATE user_profiles SET settings = ?1, updated_at = ?2 WHERE user_id = ?3')
        .bind(settingsUpdate, now, userId),
    )
  } else {
    // Clear any pending tier_change_request even for upgrades
    const settingsRow = await db
      .prepare('SELECT settings FROM user_profiles WHERE user_id = ?1')
      .bind(userId)
      .first<{ settings: string | null }>()

    let settings: Record<string, unknown> = {}
    try {
      if (settingsRow?.settings) settings = JSON.parse(settingsRow.settings) as Record<string, unknown>
    } catch { /* ignore */ }

    if (settings.tier_change_request) {
      delete settings.tier_change_request
      stmts.push(
        db.prepare('UPDATE user_profiles SET settings = ?1, updated_at = ?2 WHERE user_id = ?3')
          .bind(JSON.stringify(settings), now, userId),
      )
    }
  }

  await db.batch(stmts)

  logger.info('[TierProvisioner] Immediate tier change provisioned', {
    userId,
    orgId,
    from: currentTier,
    to: targetTier,
    creditCents,
    eventType,
  })

  return { success: true, creditCents: creditCents || undefined }
}
