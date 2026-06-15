import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export async function GET() {
try {
const user = await getCurrentUser();
if (!user) {
return NextResponse.json({ rows: [] }, { status: 200 });
}

const db = getD1();
if (!db) {
logger.error('[payment-history] Database unavailable');
return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
}

const result = await db
.prepare(
`SELECT id, sku, amount_cents, status, created_at, paid_at
FROM user_purchases
WHERE user_id = ?1
AND kind = 'one_time'
ORDER BY created_at DESC
LIMIT 20`,
)
.bind(user.id)
.all<{
id: string;
sku: string;
amount_cents: number;
status: string;
created_at: number;
paid_at: number | null;
}>();

const rows = (result.results ?? []).map(
(row: {
id: string;
sku: string;
amount_cents: number;
status: string;
created_at: number;
paid_at: number | null;
}) => {
const epoch = row.paid_at ?? row.created_at;
return {
id: row.id,
date: new Date(epoch * 1000).toLocaleDateString(),
label: row.sku,
amountCents: row.amount_cents,
status: row.status === 'paid' ? 'paid' : 'pending',
};
},
);

return NextResponse.json({ rows });
} catch (err) {
const error = err instanceof Error ? err : new Error(String(err));
logger.error('[payment-history] Fetch failed', error);
return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
}
}
