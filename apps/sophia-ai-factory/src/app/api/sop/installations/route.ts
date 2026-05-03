/**
 * GET /api/sop/installations — list user's SOP installations with last run summary.
 *
 * Auth: session cookie required.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listInstallationsForUser } from '@/lib/sop/sop-repo';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const installations = await listInstallationsForUser(db, user.id);
  return NextResponse.json({ installations });
}
