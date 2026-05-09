/**
 * /api/v1/missions/[id]/stream — SSE Stream for mission status
 *
 * Polls D1 every 2s, emits status events with `id:` cursor (SSE spec).
 * Supports Last-Event-ID reconnect: resumes from updated_at cursor so the
 * browser's native EventSource replay works without duplicate events.
 *
 * Cursor strategy: unix-ms timestamp from `updated_at` column.
 * On reconnect the browser sends `Last-Event-ID: <updated_at>` automatically
 * and we skip polling cycles until mission.updated_at > cursor.
 *
 * Auth: Authorization: Bearer <api_key>
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateMissionApiKey } from '@/forest/missions/api-key-auth';
import { createServerClient } from '@/seed/db/client';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 2000;
const MAX_DURATION_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

function safeParseResult(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { _parse_error: true, raw: raw.slice(0, 200) };
  }
}

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

/**
 * Builds a full SSE message block with mandatory `id:` cursor line.
 * The `id:` line is required for browser EventSource to set Last-Event-ID
 * automatically on reconnect (per SSE spec §9.2.6).
 */
function sseMessage(event: string, data: unknown, cursor: number | null = null): string {
  const idLine = cursor !== null ? `id: ${cursor}\n` : '';
  return `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return withRateLimit(async (r: NextRequest): Promise<NextResponse> => {
    const auth = await validateMissionApiKey(
      r.headers.get('authorization'),
      r.headers.get('x-api-key'),
    );
    if (!auth.valid) {
      return new NextResponse(JSON.stringify({ error: auth.error }), { status: 401 });
    }
    const userId = auth.userId!;

    // Parse Last-Event-ID for reconnect cursor (unix-ms timestamp).
    // Value 0 means "start from beginning" (no prior events seen).
    const lastEventIdHeader = r.headers.get('last-event-id');
    const resumeCursor = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) || 0 : 0;

    const encoder = new TextEncoder();
    const startTime = Date.now();

    const stream = new ReadableStream({
      async start(controller) {
        const db = createServerClient();
        let lastHeartbeat = Date.now();
        // Track cursor so we only emit events the client hasn't seen.
        let emittedCursor = resumeCursor;

        controller.enqueue(encoder.encode(
          sseMessage('connected', { mission_id: id, resume_cursor: resumeCursor }, null)
        ));

        while (Date.now() - startTime < MAX_DURATION_MS) {
          await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
          if (r.signal.aborted) break;

          const now = Date.now();
          if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
            // Heartbeat uses current server time as cursor so client stays in sync
            controller.enqueue(encoder.encode(sseMessage('ping', { ts: now }, now)));
            lastHeartbeat = now;
            emittedCursor = now;
          }

          try {
            const { data } = await db
              .from('engine_missions')
              .select('id, command, status, result, error, credits_used, updated_at, completed_at')
              .eq('id', id)
              .eq('user_id', userId)
              .single() as { data: MissionRow | null; error: unknown };

            if (!data) {
              controller.enqueue(encoder.encode(
                sseMessage('error', { code: 'not_found', message: 'Mission not found' }, null)
              ));
              break;
            }

            // Skip emission if client already saw this state (reconnect dedup).
            // updated_at is 0/null on brand-new missions — emit those always.
            const cursor = data.updated_at ?? 0;
            if (cursor > 0 && cursor <= emittedCursor) {
              // No state change since last emitted cursor — keep polling silently
              if (TERMINAL_STATUSES.has(data.status)) {
                // Terminal state already delivered before disconnect; send done again
                controller.enqueue(encoder.encode(
                  sseMessage('done', { status: data.status }, cursor)
                ));
                break;
              }
              continue;
            }

            emittedCursor = cursor > 0 ? cursor : now;

            controller.enqueue(encoder.encode(sseMessage('status', {
              id: data.id,
              command: data.command,
              status: data.status,
              result: safeParseResult(data.result),
              error: data.error,
              credits_used: data.credits_used,
              updated_at: data.updated_at,
              completed_at: data.completed_at,
            }, emittedCursor)));

            if (TERMINAL_STATUSES.has(data.status)) {
              controller.enqueue(encoder.encode(
                sseMessage('done', { status: data.status }, emittedCursor)
              ));
              break;
            }
          } catch (err) {
            controller.enqueue(encoder.encode(sseMessage('error', {
              code: 'db_transient',
              message: err instanceof Error ? err.message.slice(0, 200) : 'db error',
            }, null)));
          }
        }

        if (Date.now() - startTime >= MAX_DURATION_MS) {
          controller.enqueue(encoder.encode(
            sseMessage('timeout', { message: 'Stream closed after 5 minutes' }, null)
          ));
        }

        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }, { addHeaders: false, config: { intervalMs: 60_000, maxRequests: 20 } })(request);
}
