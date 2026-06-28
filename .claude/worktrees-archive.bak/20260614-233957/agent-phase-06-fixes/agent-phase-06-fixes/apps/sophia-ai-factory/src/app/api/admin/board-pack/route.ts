/**
 * GET /api/admin/board-pack — list board packs for current month
 * POST /api/admin/board-pack — create a new board pack (YYYY-MM)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PackStatus = 'draft' | 'finalized' | 'approved' | 'archived';

interface Section {
  title: string;
  items: unknown[];
}

interface BoardPack {
  id: string;
  month: string; // YYYY-MM
  status: PackStatus;
  title: string;
  sections: Record<string, Section>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// In-memory store (MVP). Replace with DB once board_packs table exists.
// ---------------------------------------------------------------------------

const packs = new Map<string, BoardPack>();

const DEFAULT_SECTIONS: Record<string, Section> = {
  '1.executive-summary': {
    title: 'Executive Summary',
    items: [],
  },
  '2.financials': {
    title: 'Financials (P&L, Burn, Runway)',
    items: [],
  },
  '3.key-metrics': {
    title: 'Key Metrics (MRR, Churn, NPS, etc.)',
    items: [],
  },
  '4.operational': {
    title: 'Operational Update (headcount, product, GTM)',
    items: [],
  },
  '5.risks': {
    title: 'Risks, Blockers & Decisions Needed',
    items: [],
  },
};

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET() {
  const auth = await requireAdmin(undefined as unknown as NextRequest);
  if (auth instanceof NextResponse) return auth;
  const list = Array.from(packs.values()).sort(
    (a, b) => (a.createdAt > b.createdAt ? -1 : 1),
  );
  return NextResponse.json({ packs: list });
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

const createSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM required'),
  title: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const currentUserId = auth.user.id;

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { month, title } = parsed.data;

  const duplicate = Array.from(packs.values()).find((p) => p.month === month);
  if (duplicate) {
    return NextResponse.json(
      {
        error: 'Board pack for this month already exists',
        packId: duplicate.id,
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const pack: BoardPack = {
    id: `bp-${month}`,
    month,
    status: 'draft',
    title: title ?? `${month} Board Pack`,
    sections: JSON.parse(JSON.stringify(DEFAULT_SECTIONS)),
    createdBy: currentUserId,
    createdAt: now,
    updatedAt: now,
  };

  packs.set(pack.id, pack);

  return NextResponse.json({ pack }, { status: 201 });
}
