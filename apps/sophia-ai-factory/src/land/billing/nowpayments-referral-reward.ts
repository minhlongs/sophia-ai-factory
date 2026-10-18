/**
 * Atomic referral reward crediting for NOWPayments post-purchase side effects.
 * @module billing/nowpayments-referral-reward
 */

import { logger } from '@/seed/utils/logger-utility'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb } from './nowpayments-ipn-db'

const REFERRAL_REWARD_CENTS = 500

export async function safelyCreditReferralReward(
  userId: string,
  _tier: Tier,
  _ipn: NowPaymentsIpnPayload,
  db: ReturnType<typeof getDb>,
  d1: D1Database
): Promise<void> {
  try {
    const { data: userProfile } = await db.from('user_profiles').select('settings').eq('user_id', userId).single()
    const settings = userProfile?.settings
      ? (typeof userProfile.settings === 'string' ? JSON.parse(userProfile.settings as string) : userProfile.settings) as Record<string, unknown>
      : null
    const referrerId = settings?.referred_by as string | undefined
    if (!referrerId) return

    const existingReward = await d1
      .prepare(`SELECT 1 FROM referral_rewards WHERE referred_user_id = ?1 LIMIT 1`)
      .bind(userId)
      .first()
    if (existingReward) return

    await atomicCreditReferralReward(userId, referrerId, d1)
  } catch (err) {
    logger.warn('[NOWPayments] Referral reward credit failed (non-fatal)', { userId, error: String(err) })
  }
}

async function atomicCreditReferralReward(
  userId: string,
  referrerId: string,
  d1: D1Database
): Promise<void> {
  const rewardCents = REFERRAL_REWARD_CENTS
  const rewardedAt = new Date().toISOString()

  await d1.batch([
    d1.prepare(
      `INSERT INTO referral_rewards (referred_user_id, referrer_user_id, reward_cents, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(referred_user_id) DO NOTHING`
    ).bind(userId, referrerId, rewardCents, rewardedAt),
    d1.prepare(
      `UPDATE user_profiles SET settings = json_set(
         COALESCE(settings, '{}'),
         '$.account_credit_cents',
         CAST(COALESCE(json_extract(settings, '$.account_credit_cents'), '0') AS INTEGER) + ?
       ), settings = json_set(
         settings, '$.last_referral_reward_at', ?
       )
       WHERE user_id = ?`
    ).bind(rewardCents, rewardedAt, referrerId),
  ])

  logger.info('[NOWPayments] Referral reward credited (atomic)', { referrerId, referredUserId: userId, rewardCents })
}
