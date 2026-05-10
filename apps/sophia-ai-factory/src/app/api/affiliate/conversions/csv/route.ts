/**
 * GET /api/affiliate/conversions/csv
 *
 * CSV export of recent conversions for the authenticated affiliate.
 * Caps at 1000 rows. Includes header row.
 *
 * @module app/api/affiliate/conversions/csv
 */

import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getRecentConversions } from '@/land/affiliates/dashboard-stats';

const MAX_ROWS = 1000;

const CSV_HEADER = [
  'conversion_id',
  'link_id',
  'offer_id',
  'network_transaction_id',
  'gross_amount_usd',
  'commission_usd',
  'status',
  'attributed_at_iso',
];

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = parseInt(searchParams.get('limit') ?? '500', 10);
  const limit = Math.max(1, Math.min(MAX_ROWS, Number.isFinite(rawLimit) ? rawLimit : 500));

  const conversions = await getRecentConversions(user.id, user.id, limit, 0);

  const lines = [CSV_HEADER.join(',')];
  for (const c of conversions) {
    lines.push(
      [
        c.conversionId,
        c.linkId,
        c.offerId,
        c.networkTransactionId,
        c.grossAmountUsd.toFixed(2),
        c.commissionUsd.toFixed(2),
        c.status,
        new Date(c.attributedAt * 1000).toISOString(),
      ]
        .map((f) => csvEscape(String(f)))
        .join(','),
    );
  }

  const filename = `affiliate-conversions-${user.id}-${Date.now()}.csv`;
  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
