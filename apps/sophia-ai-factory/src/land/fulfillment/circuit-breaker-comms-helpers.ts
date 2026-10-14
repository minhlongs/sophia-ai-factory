/**
 * D1 query and TTL extension helpers for circuit breaker customer communications.
 * @module land/fulfillment/circuit-breaker-comms-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';

const OUTAGE_COMPENSATION_KIND = 'outage_compensation';
const EXTEND_DAYS = 7;
const EXTEND_SECONDS = EXTEND_DAYS * 24 * 60 * 60;
const LOOKBACK_SECONDS = 24 * 60 * 60;

export interface AffectedPurchaseRow {
  id: string;
  user_id: string;
  expires_at: number | null;
}

interface UserEmailRow {
  email?: string;
  locale?: string;
}

interface BillingEventRow {
  id: string;
}

export async function isAlreadyCompensated(purchaseId: string): Promise<boolean> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('billing_events')
      .select('id')
      .eq('event_type', OUTAGE_COMPENSATION_KIND)
      .eq('license_nonce', purchaseId.slice(0, 16))
      .single();
    return (data as BillingEventRow | null) !== null;
  } catch {
    return false;
  }
}

export async function fetchAffectedPurchases(): Promise<AffectedPurchaseRow[]> {
  const db = createServerClient();
  const nowSec = Math.floor(Date.now() / 1000);
  const since = nowSec - LOOKBACK_SECONDS;

  const { data } = await db
    .from('user_purchases')
    .select('id, user_id, expires_at')
    .eq('kind', 'one_time')
    .eq('status', 'paid')
    .gte('created_at', since);

  return (data as AffectedPurchaseRow[] | null) ?? [];
}

export async function fetchUserInfo(userId: string): Promise<{ email: string; locale: string } | null> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('user')
      .select('email, locale')
      .eq('id', userId)
      .single();
    const row = data as UserEmailRow | null;
    if (!row?.email) return null;
    return { email: row.email, locale: row.locale ?? 'vi' };
  } catch (err) {
    logger.error('[CircuitBreakerComms] fetchUserInfo failed', err instanceof Error ? err : undefined, { userId });
    return null;
  }
}

export async function extendTtlWithAudit(
  purchase: AffectedPurchaseRow,
  openedAt: number,
): Promise<boolean> {
  const alreadyDone = await isAlreadyCompensated(purchase.id);
  if (alreadyDone) return false;

  const db = createServerClient();
  const nowSec = Math.floor(Date.now() / 1000);
  const currentExpiry = purchase.expires_at ?? nowSec;
  const newExpiry = currentExpiry + EXTEND_SECONDS;

  await db
    .from('user_purchases')
    .update({ expires_at: newExpiry, updated_at: nowSec })
    .eq('id', purchase.id);

  await db.from('billing_events').insert({
    user_id: purchase.user_id,
    license_nonce: purchase.id.slice(0, 16),
    event_type: OUTAGE_COMPENSATION_KIND,
    event_category: 'compensation',
    event_data: { purchase_id: purchase.id, opened_at: openedAt, extend_days: EXTEND_DAYS },
    email_sent: false,
    email_template: null,
    processed: true,
    processed_at: new Date().toISOString(),
  });

  return true;
}
