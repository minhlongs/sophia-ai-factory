/**
 * Post-activation effects for PayOS tier activation.
 * Layer: app/api/payos/ipn/modules
 * @module app/api/payos/ipn/modules/tier-activator-effects
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { recordAudit } from '@/seed/db/audit/audit-log';
import type { Tier } from '@/seed/types';
import type { D1Client } from '@/seed/db/client';
import { commitPayOsSubscriptionBatch } from './payroll-subscription';

export interface PayOsPostActivationParams {
  db: D1Client;
  d1: D1Database;
  userId: string;
  orgId: string | undefined;
  tier: Tier;
  billingPeriod: 'lifetime' | 'yearly' | 'monthly';
  periodEnd: string;
  orderCode: string | number;
  orderId: string;
  amount: number;
  subaccountId: string | undefined;
}

export async function runPayOsPostActivationEffects({
  db,
  d1,
  userId,
  orgId,
  tier,
  billingPeriod,
  periodEnd,
  orderCode,
  orderId,
  amount,
  subaccountId,
}: PayOsPostActivationParams): Promise<void> {
  try {
    await recordAudit(d1, {
      tableName: 'subscriptions',
      rowId: orgId ?? userId,
      action: 'update',
      actorId: userId,
      after: { tier, plan: tier.toLowerCase(), status: 'active', periodEnd, paymentId: `payos_${orderCode}`, provider: 'payos', amountVnd: amount },
    });
  } catch { /* non-fatal */ }

  try {
    const { sendReceiptEmail } = await import('@/land/billing/email/receipt-email-sender');
    const { data: userRow } = await db.from('user').select('name,email').eq('id', userId).maybeSingle();
    const userEmail = (userRow as { name?: string; email?: string } | null)?.email;
    const userName = (userRow as { name?: string; email?: string } | null)?.name;

    if (userEmail) {
      await sendReceiptEmail({
        email: userEmail,
        userName: userName ?? undefined,
        tier,
        period: billingPeriod,
        amountUsd: Math.round(amount / 25000),
        paymentId: `payos_${orderCode}`,
        paymentMethod: 'payos',
        orderId,
        locale: 'vi',
      });
    }
  } catch (receiptErr) {
    logger.warn('[PayOS IPN] Receipt email failed (non-fatal)', { error: String(receiptErr) });
  }

  if (subaccountId) {
    try {
      await d1.prepare(`UPDATE client_subaccounts SET updated_at = datetime('now') WHERE id = ?1`).bind(subaccountId).run().catch(() => {});
      logger.info('[PayOS IPN] Tagged client subaccount', { subaccountId, orderId });
    } catch (subaccountErr) {
      logger.warn('[PayOS IPN] Subaccount tagging failed (non-fatal)', { error: String(subaccountErr) });
    }
  }
}

export { commitPayOsSubscriptionBatch } from './payroll-subscription';