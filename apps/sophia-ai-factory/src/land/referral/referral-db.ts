/**
 * Raw D1 helpers for the referral subsystem.
 *
 * No business logic — only SQL. Mirrors the `land/billing/nowpayments-ipn-db.ts` style
 * (getD1(), parseX helpers, logger wrappers).
 *
 * @module referral/referral-db
 */

import { createServerClient, getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { safeCatch } from '@/seed/utils/safe-catch';
import { getErrorMessage } from '@/seed/utils/to-error';

export function getDb() {
  return createServerClient();
}

export function getRawD1() {
  return getD1();
}

function d1OrNull(): ReturnType<typeof getD1> | null {
  try {
    return getD1();
  } catch {
    return null;
  }
}

export async function findReferrerByCode(code: string): Promise<{ referrerId: string; orgId: string | null } | null> {
  const d1 = d1OrNull();
  if (!d1) return null;

  try {
    const db = getDb();
    const row = await db
      .from('referral_codes')
      .select('user_id, org_id')
      .eq('code', code)
      .eq('status', 'active')
      .maybeSingle();
    const data = row.data;
    if (!data) return null;
    return { referrerId: data.user_id as string, orgId: data.org_id as string | null };
  } catch (err) {
    safeCatch('referral.findReferrerByCode')(err);
    logger.warn('[referral] findReferrerByCode failed', {
      code,
      error: getErrorMessage(err),
    });
    return null;
  }
}
