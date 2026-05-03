/**
 * PATCH /api/admin/promo-codes/[id]/status
 * Update the status of a promo code.
 * Admin only.
 * @module app/api/admin/promo-codes/[id]/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/seed/auth/require-admin';
import { updateCodeStatus } from '@/lib/promo/promo-repo';

export const dynamic = 'force-dynamic';

const statusSchema = z.object({
  status: z.enum(['active', 'disabled', 'expired']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid status', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await updateCodeStatus(id, parsed.data.status);
    return NextResponse.json({ success: true, id, status: parsed.data.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
