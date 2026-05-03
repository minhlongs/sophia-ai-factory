/**
 * POST /api/agents/task — Create and run an agent task
 * External API wrapper around the createAgentTask server action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createAgentTask } from '@/app/actions/agent-task';

export const dynamic = 'force-dynamic';

const TaskRequestSchema = z.object({
  agentId: z.string().min(1).optional(),
  input: z.string().min(1).max(4000),
  role: z.enum(['CEO', 'Developer']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as unknown;
    const parsed = TaskRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const result = await createAgentTask(parsed.data);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ task: result.task }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
