/**
 * POST /api/mission/[id]/spend — record spend against a mission
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getErrorMessage } from '@/seed/utils/to-error';
import { recordSpend } from '@/tree/mission';

const SpendSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  amount: z.number().int().positive('amount must be a positive integer (cents)'),
  category: z.string().optional(),
  description: z.string().optional(),
});

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SpendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await recordSpend(id, parsed.data.amount, parsed.data.workspaceId);
    return NextResponse.json({
      ok: true,
      missionId: id,
      amountCents: parsed.data.amount,
      category: parsed.data.category,
      description: parsed.data.description,
    });
  } catch (err) {
    const message = getErrorMessage(err);
    if (message.includes('does not belong to workspace') || (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}