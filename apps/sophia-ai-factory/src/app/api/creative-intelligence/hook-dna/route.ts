/**
 * GET  /api/creative-intelligence/hook-dna?workspaceId=X — fetch winning hook DNA & patterns
 * POST /api/creative-intelligence/hook-dna — record or update hook DNA pattern
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess, verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  GetHookDnaSchema,
  PostHookDnaSchema,
  queryHookDnaPatterns,
  insertHookDnaPattern,
} from './hook-dna-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = {
    workspaceId: searchParams.get('workspaceId') ?? undefined,
    hookType: searchParams.get('hookType') ?? undefined,
    metric: searchParams.get('metric') ?? undefined,
    confidenceLevel: searchParams.get('confidenceLevel') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  };

  const parsed = GetHookDnaSchema.safeParse(rawQuery);
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
    const patterns = await queryHookDnaPatterns(parsed.data);
    return NextResponse.json({ patterns, count: patterns.length });
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

  const parsed = PostHookDnaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const hasOperator = await verifyWorkspaceRole(parsed.data.workspaceId, user.id, 'OPERATOR');
  if (!hasOperator) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Insufficient workspace role' },
      { status: 403 },
    );
  }

  try {
    const created = await insertHookDnaPattern(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
