/**
 * GET    /api/admin/board-pack/[id]  — get a single pack
 * PATCH  /api/admin/board-pack/[id]  — update title or status
 * DELETE /api/admin/board-pack/[id]  — remove pack
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

type PackStatus = 'draft' | 'finalized' | 'approved' | 'archived';

interface Section {
  title: string;
  items: unknown[];
}

interface BoardPack {
  id: string;
  month: string;
  status: PackStatus;
  title: string;
  sections: Record<string, Section>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const packs = new Map<string, BoardPack>();

const patchSchema = z.object({
  title: z.string().optional(),
  status: z.enum(['draft', 'finalized', 'approved', 'archived']).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(undefined as unknown as NextRequest);
  if (auth instanceof NextResponse) return auth;

  const pack = packs.get(params.id);
  if (!pack) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ pack });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const pack = packs.get(params.id);
  if (!pack) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { title, status } = parsed.data;
  if (title !== undefined) pack.title = title;
  if (status !== undefined) pack.status = status;

  pack.updatedAt = new Date().toISOString();
  packs.set(pack.id, pack);

  return NextResponse.json({ pack });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(undefined as unknown as NextRequest);
  if (auth instanceof NextResponse) return auth;

  if (!packs.has(params.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  packs.delete(params.id);
  return NextResponse.json({ ok: true });
}
