/**
 * GET /api/agents/stream — SSE endpoint for live agent task events
 * Auth-gated. Polls D1 agent_tasks for org tasks in last 60s.
 * Cloudflare Workers: ReadableStream + TextEncoder, max 60s.
 */

import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import type { AgentTaskRow } from '@/lib/agents/types';

export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 15_000;
const POLL_MS = 3_000;
const MAX_DURATION_MS = 58_000; // Stay under 60s CF Workers limit

function encodeSSE(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const orgId = user.id;

  const stream = new ReadableStream({
    async start(controller) {
      const startedAt = Date.now();
      let lastSeenCreatedAt = new Date(Date.now() - 60_000).toISOString();
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      // Heartbeat to keep CF connection alive
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encodeSSE({ type: 'heartbeat' }));
        } catch {
          // Connection closed
        }
      }, HEARTBEAT_MS);

      // Initial connection event
      controller.enqueue(encodeSSE({ type: 'connected', orgId }));

      // Poll loop with H4 fix: exponential backoff on DB errors
      // (prevents constant reconnects across all SSE clients during D1 outage)
      let consecutiveErrors = 0;
      const MAX_BACKOFF_MS = 30_000;

      while (Date.now() - startedAt < MAX_DURATION_MS) {
        if (request.signal.aborted) break;

        try {
          const db = createServerClient();
          const { data } = await db
            .from('agent_tasks')
            .select('id, agent_id, status, input, output, error_message, created_at, completed_at')
            .eq('org_id', orgId)
            .in('status', ['running', 'completed', 'failed'])
            .gt('created_at', lastSeenCreatedAt)
            .order('created_at', { ascending: true })
            .limit(20);

          consecutiveErrors = 0; // reset on success

          if (data && data.length > 0) {
            for (const row of data as unknown as AgentTaskRow[]) {
              controller.enqueue(encodeSSE({
                type: `agent.task.${row.status}`,
                taskId: row.id,
                agentId: row.agent_id,
                status: row.status,
                input: row.input?.slice(0, 200),
                errorMessage: row.error_message,
                createdAt: row.created_at,
                completedAt: row.completed_at,
              }));
            }
            lastSeenCreatedAt = (data as unknown as AgentTaskRow[])[data.length - 1].created_at;
          }
        } catch {
          consecutiveErrors++;
        }

        // Backoff: base POLL_MS, then exponential up to MAX_BACKOFF_MS, with ±20% jitter
        const backoff = consecutiveErrors === 0
          ? POLL_MS
          : Math.min(POLL_MS * Math.pow(2, consecutiveErrors), MAX_BACKOFF_MS);
        const jitter = backoff * (0.8 + Math.random() * 0.4);
        await new Promise(r => setTimeout(r, jitter));
      }

      if (heartbeatTimer) clearInterval(heartbeatTimer);
      controller.enqueue(encodeSSE({ type: 'stream_end' }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
