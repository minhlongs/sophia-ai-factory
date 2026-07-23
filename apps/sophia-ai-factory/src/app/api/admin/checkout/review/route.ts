import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

interface ReviewRow {
 order_id: string;
 user_id: string;
 tier: string;
 amount_usd_cents: number;
 status: string;
 review_reason: string | null;
 created_at: string;
}

function getDb(): D1Database {
 const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
 if (env?.DB) return env.DB as D1Database;
 const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
 if (globalDb) return globalDb;
 throw new Error('D1 database binding not available');
}

export async function GET() {
const auth = await requireAdmin();
if (auth instanceof NextResponse) return auth;

try {
const db = getDb();
const { results } = await db.prepare(
`SELECT order_id, user_id, tier, amount_usd_cents, status, review_reason, created_at
FROM pending_orders
WHERE status IN ('review_required','pending')
ORDER BY created_at DESC`
).all<ReviewRow>();
return NextResponse.json({ items: results ?? [] });
} catch (e) {
logger.error('[admin/checkout/review] GET failed', toError(e));
return NextResponse.json({ error: 'Failed to load review queue' }, { status: 500 });
}
}

type ReviewAction = 'approve' | 'reject' | 'cancel';

export async function POST(req: NextRequest) {
const auth = await requireAdmin();
if (auth instanceof NextResponse) return auth;

let body: unknown;
try {
body = await req.json();
} catch {
return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
}

const parsed =
typeof body === 'object' && body !== null && 'order_id' in body && 'action' in body
? { order_id: (body as Record<string, unknown>).order_id as string, action: (body as Record<string, unknown>).action as ReviewAction, review_reason: (body as Record<string, unknown>).review_reason as string | null }
: null;

if (!parsed || !['approve', 'reject', 'cancel'].includes(parsed.action)) {
return NextResponse.json({ error: 'Invalid review payload' }, { status: 400 });
}

try {
const db = getDb();
const status =
parsed.action === 'approve' ? 'paid' : parsed.action === 'reject' ? 'failed' : 'cancelled';

await db
.prepare(
`UPDATE pending_orders
SET status = ?, review_reason = COALESCE(?, review_reason)
WHERE order_id = ?`
)
.bind(status, parsed.review_reason ?? null, parsed.order_id)
.run();

logger.info('[admin/checkout/review] order updated', { order_id: parsed.order_id, action: parsed.action });
return NextResponse.json({ ok: true, order_id: parsed.order_id, status });
} catch (e) {
logger.error('[admin/checkout/review] POST failed', toError(e));
return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
}
}
