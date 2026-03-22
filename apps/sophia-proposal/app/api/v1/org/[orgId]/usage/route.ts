/**
 * GET /api/v1/org/:orgId/usage
 *
 * Returns MCU ledger summary for the org (requires API key auth).
 * Response: { org_id, total_credits, total_debits, balance, recent_transactions[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1Client } from '@/lib/db/client';
import { validateApiKey } from '@/lib/raas/api-key-manager';

export const dynamic = 'force-dynamic';

// ── Auth helper ────────────────────────────────────────────────────────────────

function extractApiKey(request: NextRequest): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrgBalance {
  balance: number;
  reserved: number;
  lifetime_credits: number;
  lifetime_debits: number;
  updated_at: string;
}

interface UsageRow {
  id: string;
  mcu_cost: number;
  command: string;
  created_at: string;
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const rawKey = extractApiKey(request);
  if (!rawKey) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const auth = await validateApiKey(rawKey);
  if (!auth.valid || !auth.orgId) {
    return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 });
  }

  // Org-scoped: key must belong to same org
  if (auth.orgId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = await getD1Client();

    // Get balance from org_balances (source of truth for missions)
    const { data: bal } = await db
      .from<OrgBalance>('org_balances')
      .select('balance, reserved, lifetime_credits, lifetime_debits, updated_at')
      .eq('org_id', orgId)
      .single();

    const balance = bal ?? { balance: 0, reserved: 0, lifetime_credits: 0, lifetime_debits: 0, updated_at: '' };

    // Recent usage from usage_logs
    const { data: logs } = await db
      .from<UsageRow>('usage_logs')
      .select('id, mcu_cost, command, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10);

    const recent_transactions = (logs ?? []).map((l) => ({
      id: l.id,
      command: l.command,
      mcu_cost: l.mcu_cost,
      created_at: l.created_at,
    }));

    return NextResponse.json({
      org_id: orgId,
      balance: balance.balance,
      reserved: balance.reserved,
      lifetime_credits: balance.lifetime_credits,
      lifetime_debits: balance.lifetime_debits,
      recent_transactions,
    });
  } catch (err) {
    console.error('GET /api/v1/org/[orgId]/usage error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
