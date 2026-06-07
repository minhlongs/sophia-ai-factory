import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1Raw } from '@/seed/db/client';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ rows: [] }, { status: 200 });
    }

    const db = await getD1Raw();
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

    const rows = (result.results ?? []).map((row: { id: string; sku: string; amount_cents: number; status: string; created_at: number; paid_at: number | null }) => {
      const epoch = row.paid_at ?? row.created_at;
      return {
        id: row.id,
        date: new Date(epoch * 1000).toLocaleDateString(),
        label: row.sku,
        amountCents: row.amount_cents,
        status: row.status === 'paid' ? 'paid' : 'pending',
      };
    });

    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] }, { status: 200 });
  }
}
