/**
 * POST /api/admin/actions — admin manual action executor.
 * Handles: grant_credits, reset_tier, pause_user, resume_user, replay_ipn.
 *
 * @module app/api/admin/actions/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  bodySchema,
  executeAdminAction,
  type AdminActionBody,
} from './admin-action-handlers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  let body: AdminActionBody;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request', details: getErrorMessage(err) },
      { status: 400 }
    );
  }

  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  try {
    return await executeAdminAction(db, auth.user.id, body);
  } catch (err) {
    logger.error(
      '[AdminActions] Failed',
      err instanceof Error ? err : undefined,
      { action: (body as { action: string }).action }
    );
    return NextResponse.json(
      { error: 'internal_error', details: getErrorMessage(err) },
      { status: 500 }
    );
  }
}
