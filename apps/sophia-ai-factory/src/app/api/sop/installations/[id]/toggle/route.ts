/**
 * PATCH /api/sop/installations/[id]/toggle — enable or disable an installation.
 *
 * Body: { enabled: boolean }
 * Auth + ownership check required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation, setEnabled } from '@/lib/sop/sop-repo';

export const dynamic = 'force-dynamic';

const ToggleSchema = z.object({ enabled: z.boolean() });

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getD1();
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
