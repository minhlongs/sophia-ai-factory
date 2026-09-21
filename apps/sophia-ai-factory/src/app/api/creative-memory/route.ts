/**
 * POST /api/creative-memory — create/upsert memory entry
 * GET  /api/creative-memory?workspaceId=X — list memory keys
 * DELETE /api/creative-memory?id=X — soft-delete memory
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import {
  upsertMemory,
  listMemoryKeys,
  deleteMemory,
  newMemoryId,
} from '@/tree/creative-memory';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { MemoryCategory, MemoryConfidence, CreativeMemory } from '@/seed/types/creative-domain';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MEMORY_CATEGORIES: MemoryCategory[] = [
  'identity', 'creative', 'audience', 'performance',
  'business', 'operational', 'provenance',
];

const MEMORY_SCOPES: CreativeMemory['scope'][] = [
  'global', 'campaign', 'project', 'channel',
];

const MEMORY_CONFIDENCES: MemoryConfidence[] = ['high', 'medium', 'low'];

const createMemorySchema = z.object({
  workspaceId: z.string().min(1),
  category: z.enum(MEMORY_CATEGORIES as [string, ...string[]]),
  key: z.string().min(1),
  value: z.unknown(),
  scope: z.enum(MEMORY_SCOPES as [string, ...string[]]).optional(),
  scopeId: z.string().optional(),
  confidence: z.enum(MEMORY_CONFIDENCES as [string, ...string[]]).optional(),
});

const deleteMemorySchema = z.object({
  id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST — create/upsert memory
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

  const parsed = createMemorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((e) => e.message) },
      { status: 400 },
    );
  }

  const { workspaceId, category, key, value, scope, scopeId, confidence } = parsed.data;

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const entry: CreativeMemory = {
      id: newMemoryId(),
      workspaceId,
      category: category as MemoryCategory,
      key,
      value,
      confidence: (confidence ?? 'medium') as MemoryConfidence,
      source: 'human_edit',
      evidence: JSON.stringify([]),
      scope: (scope ?? 'global') as CreativeMemory['scope'],
      scopeId,
      version: 0,
      isDeleted: false,
      createdAt: 0,
      updatedAt: 0,
    };

    const result = await upsertMemory(entry);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET — list memory keys
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
    const keys = await listMemoryKeys(workspaceId);
    return NextResponse.json({ keys });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getMemoryWorkspaceId(memoryId: string): Promise<string | null> {
  const d1 = createServerClient();
  const row = await d1
    .prepare('SELECT workspace_id FROM creative_memory WHERE id = ? AND is_deleted = 0')
    .bind(memoryId)
    .first<{ workspace_id: string; is_deleted?: number }>();
  if (!row) return null;
  if ('is_deleted' in row && row.is_deleted === 1) return null;
  return row.workspace_id ?? null;
}

// ---------------------------------------------------------------------------
// DELETE — soft-delete memory by id (query param)
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const parsed = deleteMemorySchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((e) => e.message) },
      { status: 400 },
    );
  }

  try {
    const workspaceId = await getMemoryWorkspaceId(parsed.data.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }

    const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteMemory(parsed.data.id);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
