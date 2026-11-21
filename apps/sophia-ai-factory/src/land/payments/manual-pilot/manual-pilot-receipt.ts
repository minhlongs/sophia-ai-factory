import type { D1Database } from '@cloudflare/workers-types';
import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import { sendReceiptEmail } from '@/land/billing/email/receipt-email-sender';

/** Receipt eligibility comes from committed state, never webhook arguments. */
export async function getCommittedPilotReceipt(db: D1Database, orderId: string, userId: string) {
  const row = await db.prepare(`SELECT e.amount_vnd FROM manual_pilot_financial_state f
    JOIN manual_pilot_settlements s USING(order_id)
    JOIN manual_pilot_bank_evidence e ON e.id=f.evidence_id
    JOIN manual_pilot_entitlements p USING(order_id)
    WHERE f.order_id=? AND s.user_id=? AND f.state='ACTIVE_14D'
      AND s.status='activated' AND p.revoked_at IS NULL
      AND s.org_id=f.org_id AND p.org_id=f.org_id AND p.user_id=s.user_id
      AND e.order_id=f.order_id AND e.currency='VND' AND e.order_reference=s.transfer_reference
      AND e.direction='inbound' AND e.org_id=f.org_id AND e.amount_vnd=s.expected_amount_vnd`)
    .bind(orderId,userId).first<{amount_vnd:number}>();
  if (!row || !Number.isSafeInteger(row.amount_vnd) || row.amount_vnd<=0) return null;
  return {activationStatus:'ACTIVE_14D' as const,amountVnd:row.amount_vnd};
}

/** Reuse payment-event receipt deduplication after the activation batch commits.
 * Delivery failure must never turn committed money/entitlements into a failure. */
export async function sendCommittedManualPilotReceipt(
  db: D1Database, orderId: string, userId: string,
): Promise<void> {
  try {
    const proof = await getCommittedPilotReceipt(db, orderId, userId);
    if (!proof) return;
    const customer = await db.prepare('SELECT email,name FROM "user" WHERE id=?')
      .bind(userId).first<{ email: string; name: string | null }>();
    if (!customer || !z.string().email().safeParse(customer.email).success) {
      logger.warn('[ManualPilot] Receipt customer email unavailable', { orderId });
      return;
    }
    // The sender prefixes manual_bank itself; use the unprefixed order identity.
    await db.prepare(`INSERT INTO payment_events(event_id,event_type,payload,processed)
      VALUES(?,'manual_pilot_activated',?,1) ON CONFLICT(event_id) DO NOTHING`)
      .bind(`manual_bank_${orderId}`, JSON.stringify({ orderId, userId, ...proof })).run();
    await sendReceiptEmail({
      email: customer.email,
      userName: customer.name ?? undefined,
      tier: OPTION_A_PILOT_CONTRACT.tier,
      period: OPTION_A_PILOT_CONTRACT.period,
      amountUsd: OPTION_A_PILOT_CONTRACT.priceUsd,
      paymentId: orderId,
      paymentMethod: 'manual_bank',
      orderId,
      locale: 'vi',
      ...proof,
    });
  } catch (error) {
    logger.warn('[ManualPilot] Receipt failed after committed activation (non-fatal)', {
      orderId, error: String(error),
    });
  }
}
