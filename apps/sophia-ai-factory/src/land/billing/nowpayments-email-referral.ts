/**
 * Email delivery and referral reward side effects for NOWPayments post-purchase.
 * All operations are non-fatal — errors are logged and swallowed.
 * @module billing/nowpayments-email-referral
 */

import { logger } from '@/seed/utils/logger-utility'
import { safeCatch } from '@/seed/utils/safe-catch'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb } from './nowpayments-ipn-db'
import { sendReceiptEmail } from './email/receipt-email-sender'
import { enqueueWelcomeEmail } from '@/tree/email/outbox'

const REFERRAL_REWARD_CENTS = 500

export async function invalidateLicenseCache(userId: string, d1: D1Database): Promise<void> {
  try {
    const lic = await d1
      .prepare('SELECT nonce FROM raas_licenses WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1')
      .bind(userId)
      .first<{ nonce: string }>()
    if (lic?.nonce) {
      const kv = globalThis.KV_KV as KVNamespace | undefined
      await kv?.delete(`license:${lic.nonce}`).catch((e) => { safeCatch('KV license cache delete')(e) })
    }
  } catch (e) { safeCatch('License cache invalidation')(e) }
}

export async function safelySendReceiptEmail(
  userId: string,
  tier: Tier,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  ipn: NowPaymentsIpnPayload,
  db: ReturnType<typeof getDb>
): Promise<void> {
  try {
    const { data: userRow } = await db.from('user').select('email,name').eq('id', userId).single()
    const userEmail = (userRow as { email?: string; name?: string } | null)?.email ?? ''
    if (userEmail) {
      await sendReceiptEmail({
        email: userEmail,
        tier,
        period: billingPeriod,
        amountUsd: ipn.price_amount,
        paymentId: ipn.payment_id,
        paymentMethod: 'nowpayments',
        orderId: ipn.order_id ?? '',
        locale: 'en',
      })
    }
  } catch (err) {
    logger.warn('[NOWPayments] Receipt email failed (non-fatal)', { userId, err: String(err) })
  }
}

export async function safelyEnqueueWelcomeEmail(
  userId: string,
  tier: Tier,
  ipn: NowPaymentsIpnPayload,
  db: ReturnType<typeof getDb>,
  d1: D1Database
): Promise<void> {
  try {
    const { data: userRow } = await db.from('user').select('email,name').eq('id', userId).single()
    const userEmail = (userRow as { email?: string; name?: string } | null)?.email ?? ''
    const userName = (userRow as { email?: string; name?: string } | null)?.name ?? ''
    if (userEmail) {
      await enqueueWelcomeEmail(d1, {
        paymentId: `post_purchase_welcome_${ipn.payment_id}`,
        toEmail: userEmail,
        template: 'post-purchase-welcome',
        payload: {
          ownerFullName: userName || userEmail.split('@')[0],
          tier,
          locale: 'vi',
        },
      })
    }
  } catch (err) {
    logger.warn('[NOWPayments] Post-purchase welcome email enqueue failed (non-fatal)', { userId, error: String(err) })
  }
}

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
