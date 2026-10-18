import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type { D1Client } from '@/seed/db/client';
import {
  commitPayOsSubscriptionBatch,
  runPayOsPostActivationEffects,
} from './tier-activator-effects';
import { findAndValidatePayOsOrder } from './tier-activator-validator';

export {
  commitPayOsSubscriptionBatch,
  runPayOsPostActivationEffects,
  type PayOsPostActivationParams,
} from './tier-activator-effects';

export interface ActivateTierParams {
  db: D1Client;
  d1: D1Database;
  orderCode: string | number;
  paymentLinkId: string;
  amount: number;
  eventId: string;
}

export async function activatePayOsTier({
  db,
  d1,
  orderCode,
  paymentLinkId,
  amount,
  eventId,
}: ActivateTierParams): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const validation = await findAndValidatePayOsOrder({
    db,
    orderCode,
    paymentLinkId,
    amount,
    eventId,
  });

  if (!validation.ok) {
    return validation;
  }

  const { orderId, userId, tier, billingPeriod, periodEnd, orgId, subaccountId } = validation.data;
  const now = new Date().toISOString();

  await commitPayOsSubscriptionBatch({
    db,
    d1,
    orgId,
    tier,
    periodEnd,
    now,
    orderCode,
    orderId,
  });

  await runPayOsPostActivationEffects({
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
  });

  await db.from('payos_events').update({ processed: 1, amount }).eq('event_id', eventId);
  logger.info('[PayOS IPN] Tier activated', { userId, orgId, tier, orderCode, amount });
  return { ok: true };
}