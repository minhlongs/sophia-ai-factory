/**
 * PATCH /api/sop/installations/[id]/toggle — enable or disable an installation.
 *
 * Body: { enabled: boolean }
 * Auth + ownership check required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation, setEnabled } from '@/tree/sop/sop-repo';
import { getSopD1 } from '@/tree/sop/d1';

export const dynamic = 'force-dynamic';

const ToggleSchema = z.object({ enabled: z.boolean() });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getSopD1();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const inst = await getInstallation(db, id);
  if (!inst) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (inst.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ToggleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'enabled (boolean) required' }, { status: 400 });

  await setEnabled(db, id, parsed.data.enabled);
  return NextResponse.json({ ok: true });
}
