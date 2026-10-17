/**
 * POST /api/creative-identity — create or update workspace identity
 * GET  /api/creative-identity?workspaceId=X — get active identity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import {
  getActiveIdentity,
  createIdentity,
  updateIdentity,
} from '@/tree/creative-identity';
import { getErrorMessage } from '@/seed/utils/to-error';
import { buildIdentity, createIdentitySchema } from './creative-identity-schema';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST — create or update identity
// ---------------------------------------------------------------------------

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

  const parsed = createIdentitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((e) => e.message) },
      { status: 400 },
    );
  }

  const { workspaceId } = parsed.data;

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const existing = await getActiveIdentity(workspaceId);
    const identity = buildIdentity(parsed.data, user.id, existing ?? undefined);

    const result = existing
      ? await updateIdentity(identity)
      : await createIdentity(identity);

    return NextResponse.json(result, { status: existing ? 200 : 201 });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET — active identity for workspace
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required' },
      { status: 400 },
    );
  }

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const identity = await getActiveIdentity(workspaceId);
    if (!identity) {
      return NextResponse.json({ identity: null });
    }
    return NextResponse.json({ identity });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
