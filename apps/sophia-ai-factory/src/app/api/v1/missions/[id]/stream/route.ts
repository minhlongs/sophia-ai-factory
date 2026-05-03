/**
 * /api/v1/missions/[id]/stream — SSE Stream for mission status
 *
 * Polls D1 every 2s, emits status events.
 * Closes stream on terminal state (succeeded/failed/cancelled) or after 5 min.
 *
 * Auth: Authorization: Bearer <api_key>
 */

import { NextRequest } from 'next/server';
import { validateMissionApiKey } from '@/lib/missions/api-key-auth';
import { createServerClient } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 2000;
const MAX_DURATION_MS = 5 * 60 * 1000;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

interface MissionRow {
  id: string;
  command: string;
  status: string;
  result: string | null;
  error: string | null;
  credits_used: number;
  updated_at: number;
  completed_at: number | null;
}

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateMissionApiKey(
    request.headers.get('authorization'),
    request.headers.get('x-api-key'),
  );
  if (!auth.valid) {
    return new Response(JSON.stringify({ error: auth.error }), { status: 401 });
  }
  const userId = auth.userId!;

  const { id } = await params;

  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const db = createServerClient();

      // Send initial connected event
      controller.enqueue(encoder.encode(sseMessage('connected', { mission_id: id })));

      while (Date.now() - startTime < MAX_DURATION_MS) {
        await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));

        if (request.signal.aborted) break;

        try {
          const { data } = await db
            .from('engine_missions')
            .select('id, command, status, result, error, credits_used, updated_at, completed_at')
            .eq('id', id)
            .eq('user_id', userId)
            .single() as { data: MissionRow | null; error: unknown };

          if (!data) {
            controller.enqueue(encoder.encode(sseMessage('error', { message: 'Mission not found' })));
            break;
          }

          controller.enqueue(encoder.encode(sseMessage('status', {
            id: data.id,
            command: data.command,
            status: data.status,
            result: data.result ? JSON.parse(data.result) : null,
            error: data.error,
            credits_used: data.credits_used,
            updated_at: data.updated_at,
            completed_at: data.completed_at,
          })));

          if (TERMINAL_STATUSES.has(data.status)) {
            controller.enqueue(encoder.encode(sseMessage('done', { status: data.status })));
            break;
          }
        } catch {
          // DB error — keep polling
        }
      }

      // Timeout event
      if (Date.now() - startTime >= MAX_DURATION_MS) {
        controller.enqueue(encoder.encode(sseMessage('timeout', { message: 'Stream closed after 5 minutes' })));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
