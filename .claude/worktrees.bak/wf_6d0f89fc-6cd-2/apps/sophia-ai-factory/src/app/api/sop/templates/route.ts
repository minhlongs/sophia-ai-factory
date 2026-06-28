/**
 * GET /api/sop/templates — list official published SOP templates.
 *
 * Auth: getCurrentUser() session cookie.
 * Returns array of template rows (webhookSecret never included).
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listOfficialTemplates } from '@/tree/sop/sop-repo';
import { getSopD1 } from '@/tree/sop/d1';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSopD1();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const templates = await listOfficialTemplates(db);
  return NextResponse.json({ templates });
}
