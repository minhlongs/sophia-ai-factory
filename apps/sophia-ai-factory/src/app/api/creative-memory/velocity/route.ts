/**
 * GET  /api/creative-memory/velocity?workspaceId=X — fetch learning velocity metrics
 * POST /api/creative-memory/velocity — record/update learning velocity entry
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess, verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  GetVelocitySchema,
  PostVelocitySchema,
  queryVelocityEntries,
  insertVelocityEntry,
} from './velocity-route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = {
    workspaceId: searchParams.get('workspaceId') ?? undefined,
    entityType: searchParams.get('entityType') ?? undefined,
    channel: searchParams.get('channel') ?? undefined,
  };

  const parsed = GetVelocitySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const records = await queryVelocityEntries(parsed.data);
    return NextResponse.json({ velocity: records, count: records.length });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PostVelocitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const hasOperatorRole = await verifyWorkspaceRole(parsed.data.workspaceId, user.id, 'OPERATOR');
  if (!hasOperatorRole) {
    return NextResponse.json({ error: 'Forbidden', message: 'Insufficient workspace role' }, { status: 403 });
  }

  try {
    const created = await insertVelocityEntry(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
