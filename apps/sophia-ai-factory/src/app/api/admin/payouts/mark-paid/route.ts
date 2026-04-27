/**
 * POST /api/admin/payouts/mark-paid
 *
 * Atomically marks a user's available balance as paid.
 * Admin-only (session role check). Notifies user via Telegram (fire-and-forget).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import { MarkPaidSchema } from '@/lib/wallet/payout-validators';
import { markUserPaid } from '@/lib/wallet/payout-processor';
import { notifyPayoutSent } from '@/lib/wallet/payout-telegram-notify';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const adminUser = await getCurrentUserFromHeaders(req.headers);
  if (!adminUser || adminUser.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminId = adminUser.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = MarkPaidSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.flatten() },
      { status: 422 }
    );
  }

  const { userId, amount, method, reference, notes } = parseResult.data;

  try {
    const { payoutId } = await markUserPaid({ userId, amount, method, reference, adminId, notes });

    // Fire-and-forget notification — do not await to keep response fast
    void notifyPayoutSent(userId, amount, method, reference);

    logger.info('[admin/payouts/mark-paid] Payout complete', { payoutId, userId, amount, method });
    return NextResponse.json({ ok: true, payoutId });
  } catch (error) {
    const err = toError(error);
    logger.error('[admin/payouts/mark-paid] Failed', err);

    // Return 400 for business rule violations (threshold, balance mismatch)
    const msg = err.message ?? '';
    const isBizError =
      msg.includes('below minimum') ||
      msg.includes('does not match') ||
      msg.includes('No wallet found');

    return NextResponse.json(
      { error: isBizError ? msg : 'Failed to process payout' },
      { status: isBizError ? 400 : 500 }
    );
  }
}
