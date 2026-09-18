/**
 * Grants default signup bonus credits directly using D1.
 * Layer: seed/auth (foundational signup lifecycle)
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export async function grantSignupBonusCredits(userId: string, amount = 50): Promise<boolean> {
  try {
    const d1 = await getD1();
    if (!d1) return false;

    await d1.prepare(
      `INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
       VALUES (?, ?, ?, strftime('%s','now'))
       ON CONFLICT(user_id) DO UPDATE SET
         credits_remaining = credits_remaining + excluded.credits_remaining,
         credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased,
         updated_at = strftime('%s','now')`
    ).bind(userId, amount, amount).run();

    await d1.prepare(
      `INSERT INTO mcu_transactions (user_id, delta, reason, metadata)
       VALUES (?, ?, ?, ?)`
    ).bind(userId, amount, 'Signup Bonus', JSON.stringify({ source: 'better_auth_signup' })).run();

    return true;
  } catch (err) {
    logger.warn('[SignupBonus] Failed to grant initial signup bonus credits', toError(err));
    return false;
  }
}
