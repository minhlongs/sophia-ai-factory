/**
 * PATCH /api/creative-memory/[id]/correct — Correct a creative memory entry
 *
 * Auth: Bearer token via getCurrentUser()
 * Delegates to correctCreativeMemory server action
 * Returns updated memory entry with event emission status
 *
 * @module app/api/creative-memory/[id]/correct
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { correctCreativeMemory, type CorrectMemoryInput } from '@/land/creative-memory/actions';
import { getErrorMessage } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

// ── Validation ────────────────────────────────────────────────────────────────

const correctMemorySchema = z.object({
  correctedContent: z.unknown(),
  correctionReason: z.string().min(1).max(500),
  missionId: z.string().optional(),
  agentId: z.string().optional(),
  runId: z.string().optional(),
});

// ── Route Handler ────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Validate input
    const parsed = correctMemorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    // Delegate to server action
    const input: CorrectMemoryInput = {
      memoryId: id,
      ...parsed.data,
    };

    const result = await correctCreativeMemory(input);

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        NOT_AUTHENTICATED: 401,
        VALIDATION_FAILED: 400,
        MEMORY_NOT_FOUND: 404,
        FORBIDDEN: 403,
        DB_ERROR: 500,
        EMIT_FAILED: 500,
      };
      return NextResponse.json(
        { error: result.error.message },
        { status: statusMap[result.error.code] ?? 500 },
      );
    }

    return NextResponse.json({
      memory: result.value.memory,
      eventEmitted: result.value.eventEmitted,
    });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}