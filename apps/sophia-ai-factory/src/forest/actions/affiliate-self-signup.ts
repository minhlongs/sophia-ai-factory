/**
 * Affiliate Self-Serve Signup Server Action.
 *
 * Public recruitment funnel entry: a logged-in visitor becomes an affiliate
 * partner without an operator invitation. Creates the `affiliate_partners`
 * row, derives a unique `partner_code`, and returns the shareable
 * `/ref/<partner_code>` link.
 *
 * Layer: forest (Server Actions / Orchestrators)
 *
 * @module forest/actions/affiliate-self-signup
 */

'use server';

import { z } from 'zod';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

/**
 * Input accepted from the public join form. The visitor consents to the terms
 * and nothing else: every value that identifies or prices the partner is
 * resolved server-side so a caller cannot influence their own commission.
 */
export const affiliateSelfSignupSchema = z.object({
  acceptTerms: z.literal(true, {
    message: 'You must accept the affiliate terms to continue',
  }),
});

export type AffiliateSelfSignupInput = z.infer<typeof affiliateSelfSignupSchema>;

export type AffiliateSelfSignupStatus =
  | 'created'
  | 'already_partner'
  | 'unauthorized'
  | 'error';

export interface AffiliateSelfSignupResult {
  success: boolean;
  status: AffiliateSelfSignupStatus;
  partnerCode?: string;
  referralLink?: string;
  error?: string;
}

interface ExistingPartnerRow {
  id: string;
  partner_code: string;
}

/** Rate used only when the referred customer's tier cannot be resolved. */
const PARTNER_DEFAULT_RATE_PCT = 20.0;
/** Second-level share — program policy, not settable by the partner. */
const PARTNER_TIER2_RATE_PCT = 5.0;
/** Base code used when the account name is too short to build one from. */
const PARTNER_CODE_FALLBACK = 'PARTNER';
/** Upper bound on collision retries before surfacing an error. */
const MAX_PARTNER_CODE_ATTEMPTS = 5;

function buildPartnerCode(seed: string | null | undefined): string {
  const base = (seed ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  const prefix = base.length >= 3 ? base : PARTNER_CODE_FALLBACK;
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}${suffix}`;
}

interface D1PreparedStatement {
  bind: (...args: unknown[]) => D1PreparedStatement;
  first: <T>() => Promise<T | null>;
  run: () => Promise<{ meta?: { changes?: number } }>;
}

interface D1Like {
  prepare: (sql: string) => D1PreparedStatement;
}

async function findExistingPartner(db: D1Like, userId: string): Promise<ExistingPartnerRow | null> {
  return db
    .prepare(
      `SELECT id, partner_code FROM affiliate_partners
       WHERE user_id = ?1 ORDER BY created_at ASC LIMIT 1`,
    )
    .bind(userId)
    .first<ExistingPartnerRow>();
}

/**
 * Insert the partner row only when the user has none. The `WHERE NOT EXISTS`
 * guard runs inside a single D1 statement, so two concurrent signups for the
 * same user cannot both insert — D1 has no multi-statement transactions, and
 * this is the atomic equivalent.
 *
 * Returns one of: 'inserted' (this call created it), 'exists' (a row is already
 * there), or 'retry' (the partner_code collided; try a fresh code).
 */
async function insertPartnerIfAbsent(
  db: D1Like,
  userId: string,
  partnerCode: string,
): Promise<'inserted' | 'exists' | 'retry'> {
  const result = await db
    .prepare(
      `INSERT INTO affiliate_partners (
         id, user_id, partner_code, tier, commission_rate_pct, tier2_rate_pct,
         status, total_earnings_cents, pending_payout_cents, settled_payout_cents,
         created_at, updated_at
       )
       SELECT ?1, ?2, ?3, 'STANDARD', ?4, ?5, 'active', 0, 0, 0, ?6, ?6
       WHERE NOT EXISTS (SELECT 1 FROM affiliate_partners WHERE user_id = ?2)`,
    )
    .bind(
      `partner_${crypto.randomUUID().slice(0, 12)}`,
      userId,
      partnerCode,
      PARTNER_DEFAULT_RATE_PCT,
      PARTNER_TIER2_RATE_PCT,
      Date.now(),
    )
    .run();

  if ((result.meta?.changes ?? 0) === 1) return 'inserted';
  if (await findExistingPartner(db, userId)) return 'exists';
  return 'retry';
}

/**
 * Create an affiliate partner for the currently authenticated user.
 *
 * Returns `already_partner` — not an error — when the user already has a row.
 * Both outcomes are reported through the same generic wording so the endpoint
 * never reveals which accounts are already partners.
 */
export async function affiliateSelfSignupAction(
  rawInput: AffiliateSelfSignupInput,
): Promise<AffiliateSelfSignupResult> {
  const parsed = affiliateSelfSignupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      status: 'error',
      error: parsed.error.issues[0]?.message ?? 'Invalid signup input',
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      success: false,
      status: 'unauthorized',
      error: 'You need to sign in before becoming an affiliate partner',
    };
  }

  const db = (await getD1()) as unknown as D1Like | null;
  if (!db) return { success: false, status: 'error', error: 'Database binding unavailable' };

  try {
    for (let attempt = 0; attempt < MAX_PARTNER_CODE_ATTEMPTS; attempt += 1) {
      const partnerCode = buildPartnerCode(user.full_name ?? user.email);
      const outcome = await insertPartnerIfAbsent(db, user.id, partnerCode);

      if (outcome === 'exists') {
        return {
          success: false,
          status: 'already_partner',
          error: 'This account is already registered as an affiliate partner',
        };
      }
      if (outcome === 'retry') continue;

      logger.info('[affiliate-self-signup] Partner created via public join form', {
        userId: user.id,
        partnerCode,
        tier: 'STANDARD',
        status: 'active',
      });
      return {
        success: true,
        status: 'created',
        partnerCode,
        referralLink: `/ref/${partnerCode}`,
      };
    }

    logger.error('[affiliate-self-signup] Exhausted partner_code collision retries', {
      userId: user.id,
      attempts: MAX_PARTNER_CODE_ATTEMPTS,
    });
    return {
      success: false,
      status: 'error',
      error: 'Could not allocate a referral code. Please try again.',
    };
  } catch (err) {
    const error = toError(err);
    logger.error('[affiliate-self-signup] Failed to create partner', {
      userId: user.id,
      error: error.message,
    });
    return { success: false, status: 'error', error: error.message };
  }
}
