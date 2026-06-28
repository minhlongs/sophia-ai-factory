/**
 * POST /api/agents/feedback
 *
 * Accepts a thumbs up/down signal for an agent task result.
 * Validates body via Zod, then calls track(AGENT_FEEDBACK, ...) fire-and-forget.
 *
 * Security:
 * - Auth required (getCurrentUser)
 * - comment field limited to 280 chars by Zod schema
 * - No raw prompt content stored — only task_id + score + comment
 *
 * Edge runtime compatible (Cloudflare Workers).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { track } from '@/land/signals/track';
import { D1Events } from '@/land/signals/d1-event-types';
import { logger } from '@/seed/utils/logger-utility';


// ── Validation ───────────────────────────────────────────────────────────────

const feedbackBodySchema = z.object({
  task_id:    z.string().min(1).max(128),
  agent_role: z.string().min(1).max(64),
  score:      z.union([z.literal(1), z.literal(-1)]),
  comment:    z.string().max(280).optional(),
});

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth — any authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 },
      );
    }

    // Parse + validate body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = feedbackBodySchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid feedback payload', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { task_id, agent_role, score, comment } = validation.data;

    // org_id scope (Sophia: single-tenant per user — H2 fix: standardize on user.id
    // to match stream/pause/status/task routes; multi-org not on roadmap per YAGNI)
    const orgId = user.id;

    logger.info('[Agents Feedback] Received', {
      userId: user.id,
      taskId: task_id,
      score,
    });

    // Emit signal fire-and-forget (must not block response)
    void track(D1Events.AGENT_FEEDBACK, user.id, {
      task_id,
      agent_role,
      score,
      comment,
    }, orgId);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logger.error(
      '[Agents Feedback] Critical error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
