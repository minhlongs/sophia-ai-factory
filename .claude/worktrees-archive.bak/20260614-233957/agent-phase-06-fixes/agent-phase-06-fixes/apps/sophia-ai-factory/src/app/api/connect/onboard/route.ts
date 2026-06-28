/**
 * POST /api/connect/onboard
 *
 * Generates a Stripe Connect Express Account Link for the authenticated user
 * to complete KYC. Reuses an existing acct_... if previously started.
 *
 * Auth: required (Better Auth session).
 * Side effects: writes user_payout_settings.stripe_account_id (and
 * stripe_onboarding_started_at) on first onboarding attempt.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1Raw } from '@/seed/db/client';
import { createOnboardLink } from '@/land/payouts/stripe-connect';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

const BodySchema = z.object({
  returnUrl: z.string().url().optional(),
  refreshUrl: z.string().url().optional(),
  country: z.string().length(2).optional(),
});

const PROD_URL = process.env.PROD_URL ?? 'https://sophia.agencyos.network';
const DEFAULT_RETURN = `${PROD_URL}/dashboard/affiliate?connect=success`;
const DEFAULT_REFRESH = `${PROD_URL}/dashboard/affiliate?connect=refresh`;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    const body = (await request.json().catch(() => ({}))) as unknown;
    parsed = BodySchema.parse(body);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body', detail: getErrorMessage(err) }, { status: 400 });
  }

  const db = await getD1Raw();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const existing = (await db
    .prepare('SELECT stripe_account_id FROM user_payout_settings WHERE user_id = ?')
    .bind(user.id)
    .first()) as { stripe_account_id: string | null } | null;

  try {
    const result = await createOnboardLink({
      userId: user.id,
      existingAccountId: existing?.stripe_account_id ?? undefined,
      email: user.email ?? undefined,
      returnUrl: parsed.returnUrl ?? DEFAULT_RETURN,
      refreshUrl: parsed.refreshUrl ?? DEFAULT_REFRESH,
      country: parsed.country,
    });

    // Upsert account ID + start timestamp (only on first onboarding).
    if (!existing) {
      await db
        .prepare(
          `INSERT INTO user_payout_settings (user_id, stripe_account_id, stripe_account_status, stripe_onboarding_started_at)
           VALUES (?, ?, 'pending', datetime('now'))`,
        )
        .bind(user.id, result.accountId)
        .run();
    } else if (!existing.stripe_account_id) {
      await db
        .prepare(
          `UPDATE user_payout_settings
             SET stripe_account_id = ?, stripe_account_status = 'pending',
                 stripe_onboarding_started_at = datetime('now')
           WHERE user_id = ?`,
        )
        .bind(result.accountId, user.id)
        .run();
    }

    return NextResponse.json({
      url: result.url,
      accountId: result.accountId,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    logger.error('[connect/onboard] failed', undefined, {
      userId: user.id,
      error: getErrorMessage(err),
    });
    return NextResponse.json({ error: 'Stripe onboarding failed' }, { status: 500 });
  }
}
