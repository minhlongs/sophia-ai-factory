/**
 * POST /api/account/delete/request
 * Account self-delete stage 1 (email confirmation).
 *
 * Body: { action: 'request' | 'cancel' }
 *  - 'request' (default): create deletion request, mail confirmation link
 *  - 'cancel': mark active request as cancelled (allowed any time before scheduled_at)
 *
 * @module app/api/account/delete/request/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { type z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { bodySchema, cancelRequest, createRequest } from './request-handlers';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await req.json().catch(() => ({}));
    parsed = bodySchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body', details: err instanceof Error ? err.message : 'unknown' },
      { status: 400 }
    );
  }

  let db: D1Database;
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 database binding not available');
    db = _db;
  } catch (err) {
    logger.warn('[acct-delete] D1 unavailable', { error: String(err) });
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  if (parsed.action === 'cancel') {
    return cancelRequest(db, user.id);
  }

  return createRequest(db, user.id, user.email ?? '');
}
