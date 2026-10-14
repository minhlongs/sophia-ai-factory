/**
 * Post-Purchase Attribution, Founder Notification, and Subaccount Handlers
 *
 * Layer: land/billing/post-purchase
 */

import { logger } from '@/seed/utils/logger-utility'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers'
import { getDb } from '../nowpayments-ipn-db'
import { notifyFounderPaymentSuccess } from '@/tree/telegram/telegram-admin-notifier'
import { markLeadPaid } from '@/land/telegram-sales/telegram-lead-repo'
import { safelyRecordAffiliateCommission } from '@/tree/affiliates/affiliate-attribution'

export async function safelyNotifyFounderPayment(
  userId: string,
  tier: Tier,
  ipn: NowPaymentsIpnPayload,
  db: ReturnType<typeof getDb>,
  d1: D1Database,
): Promise<void> {
  try {
    const { data: userRow } = await db.from('user').select('email,name').eq('id', userId).single()
    const userEmail = (userRow as { email?: string; name?: string } | null)?.email ?? ipn.customer_email ?? ''
    const userName = (userRow as { email?: string; name?: string } | null)?.name ?? 'Customer'

    const purchaseCount = await d1
      .prepare(`SELECT COUNT(*) as cnt FROM user_purchases WHERE status = 'paid'`)
      .first<{ cnt: number }>()
      .catch(() => null)
    const paidCount = purchaseCount?.cnt ?? 1

    await notifyFounderPaymentSuccess({
      customerName: userName,
      email: userEmail,
      tier,
      amountUsd: ipn.price_amount ?? ipn.actually_paid ?? 0,
      provider: 'nowpayments',
      paymentId: ipn.payment_id,
      orderId: ipn.order_id,
      customerIndex: paidCount,
    })

    if (ipn.order_id && ipn.order_id.includes('sophia_tg_')) {
      const match = ipn.order_id.match(/sophia_tg_([^_]+)_/)
      if (match) {
        await markLeadPaid(match[1], ipn.order_id).catch(() => {})
      }
    }
  } catch (err) {
    logger.warn('[NOWPayments] Founder notification failed (non-fatal)', {
      userId,
      error: String(err),
    })
  }
}

export async function safelyTagSubaccount(ipn: NowPaymentsIpnPayload, d1: D1Database): Promise<void> {
  if (!ipn.order_id) return
  try {
    const order = await d1
      .prepare('SELECT subaccount_id FROM pending_orders WHERE order_id = ?1 LIMIT 1')
      .bind(ipn.order_id)
      .first<{ subaccount_id?: string | null }>()
      .catch(() => null)

    if (order?.subaccount_id) {
      await d1
        .prepare(`UPDATE client_subaccounts SET updated_at = datetime('now') WHERE id = ?1`)
        .bind(order.subaccount_id)
        .run()
        .catch(() => {})
      logger.info('[NOWPayments] Tagged client subaccount', {
        subaccountId: order.subaccount_id,
        orderId: ipn.order_id,
      })
    }
  } catch (err) {
    logger.warn('[NOWPayments] Subaccount tagging failed (non-fatal)', { error: String(err) })
  }
}

export async function safelyAttributeAffiliateCommission(
  userId: string,
  ipn: NowPaymentsIpnPayload,
  d1: D1Database,
): Promise<void> {
  try {
    const grossAmount = ipn.price_amount ?? ipn.actually_paid ?? 0
    const grossAmountCents = Math.round(grossAmount * 100)
    await safelyRecordAffiliateCommission(
      {
        provider: 'nowpayments',
        paymentId: String(ipn.payment_id),
        orderId: ipn.order_id ?? null,
        customerId: userId,
        grossAmountCents,
        currency: 'USDT',
      },
      d1,
    )
  } catch (err) {
    logger.warn('[NOWPayments] Affiliate attribution failed (non-fatal)', {
      paymentId: ipn.payment_id,
      error: String(err),
    })
  }
}
