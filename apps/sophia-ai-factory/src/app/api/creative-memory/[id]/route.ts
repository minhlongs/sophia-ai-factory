/**
 * GET    /api/creative-memory/[id] — fetch single memory
 * DELETE /api/creative-memory/[id] — soft-delete memory
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { deleteMemory } from '@/tree/creative-memory';
import { memoryRowToDomain } from '@/tree/creative-memory/types';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

/**
 * The [id] param is a memory ID (prefixed `mem_`).
 * We need the workspaceId to verify access. For GET, we query by workspaceId
 * + category + key and find the matching id. For DELETE, we accept workspaceId
 * in the body since the caller already knows which workspace they own.
 *
 * Simpler approach: store workspace_id in the memory row — look up the row
 * directly by id to get workspace_id, then verify access.
 */

async function getMemoryWorkspaceId(memoryId: string): Promise<string | null> {
  const d1 = createServerClient();
  const row = await d1
    .prepare('SELECT workspace_id FROM creative_memory WHERE id = ?')
    .bind(memoryId)
    .first<{ workspace_id: string }>();
  return row?.workspace_id ?? null;
}

// ---------------------------------------------------------------------------
// GET — fetch single memory by id
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const workspaceId = await getMemoryWorkspaceId(id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const d1 = createServerClient();
    const row = await d1
      .prepare(
        `SELECT id, workspace_id, category, key, value, confidence, source,
                evidence, scope, scope_id, version, is_deleted,
                created_at, updated_at, expires_at
         FROM creative_memory
         WHERE id = ? AND is_deleted = 0`,
      )
      .bind(id)
      .first();

    if (!row) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    const memory = memoryRowToDomain(row as Parameters<typeof memoryRowToDomain>[0]);
    return NextResponse.json({ memory });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — soft-delete memory by id
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const workspaceId = await getMemoryWorkspaceId(id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteMemory(id);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
