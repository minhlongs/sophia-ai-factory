/**
 * Auto-handover Database Helpers
 * Layer: tree/handover/auto
 */

import { AGENCY_SOP_MAP, TIER_SOP_COUNTS } from '@/tree/handover/handover-types'
import type { AgencyType } from '@/tree/handover/handover-types'
import type { Tier } from '@/seed/types'

/** Derive starter SOP slugs from tier + agencyType, capped to tier limit. */
export function getStarterSops(tier: Tier, agencyType: AgencyType): string[] {
  const cap = TIER_SOP_COUNTS[tier] ?? 3
  const candidates = AGENCY_SOP_MAP[agencyType] ?? AGENCY_SOP_MAP.other
  return candidates.slice(0, cap)
}

/** Look up user by email in D1 users table. Returns userId or null. */
export async function findUserByEmail(db: D1Database, email: string): Promise<string | null> {
  email = email.toLowerCase().trim()
  try {
    const row = await db
      .prepare(`SELECT id FROM user WHERE email = ?1 LIMIT 1`)
      .bind(email)
      .first<{ id: string }>()
    return row?.id ?? null
  } catch {
    return null
  }
}

/** Check if handover already exists for this paymentId (idempotency). */
export async function handoverExistsForPayment(db: D1Database, paymentId: string): Promise<boolean> {
  try {
    const row = await db
      .prepare(`SELECT id FROM customer_handovers WHERE trigger_payment_id = ?1 LIMIT 1`)
      .bind(paymentId)
      .first<{ id: string }>()
    return !!row
  } catch {
    return false
  }
}

/** Check if user already has a handover (existing customer upgrading). */
export async function getExistingHandoverId(db: D1Database, userId: string): Promise<string | null> {
  try {
    const row = await db
      .prepare(`SELECT id FROM customer_handovers WHERE customer_user_id = ?1 ORDER BY created_at DESC LIMIT 1`)
      .bind(userId)
      .first<{ id: string }>()
    return row?.id ?? null
  } catch {
    return null
  }
}

/** Count paid/completed purchases for user (to detect first purchase). */
export async function countUserPurchases(db: D1Database, userId: string): Promise<number> {
  try {
    const row = await db
      .prepare(`SELECT COUNT(*) as cnt FROM user_purchases WHERE user_id = ?1 AND status = 'paid'`)
      .bind(userId)
      .first<{ cnt: number }>()
    return row?.cnt ?? 0
  } catch {
    return 0
  }
}

/**
 * Build a locale-aware URL path segment.
 * Omit the locale prefix for the default locale ('en') to avoid middleware
 * 307 redirects (localePrefix: 'as-needed' drops /en/ → /).
 */
export function localePath(locale: string): string {
  return locale === 'en' ? '' : `/${locale}`
}
