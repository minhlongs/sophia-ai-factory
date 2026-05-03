/**
 * /api/sop/installations/[id]
 *
 * GET  — fetch installation detail (owner only)
 * DELETE — delete installation (owner only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation, deleteInstallation } from '@/lib/sop/sop-repo';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

async function getInstallationWithOwnerCheck(id: string, userId: string) {
  const db = getD1();
  if (!db) return { error: 'DB unavailable', status: 500 as const };
  const inst = await getInstallation(db, id);
  if (!inst) return { error: 'Not found', status: 404 as const };
  if (inst.user_id !== userId) return { error: 'Forbidden', status: 403 as const };
  return { inst, db };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await getInstallationWithOwnerCheck(id, user.id);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ installation: result.inst });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await getInstallationWithOwnerCheck(id, user.id);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await deleteInstallation(result.db, id);
  return NextResponse.json({ ok: true });
}
