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
 * Two separate variables prevent clock-skew dedup suppression (Wave-14 fix):
 *   - eventCursor  — advances ONLY when a real DB status event is emitted.
 *   - lastHeartbeatTs — advances on keepalive ticks; NEVER touches eventCursor.
 * Heartbeat emits `:` comment line (no `id:`) per SSE spec so Last-Event-ID
 * is never polluted by server-wall-clock timestamps.
 *
 * Auth: Authorization: Bearer <api_key>
 */

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { validateMissionApiKey, apiKeyAuthErrorResponse } from '@/tree/missions/api-key-auth';
import { createServerClient } from '@/seed/db/client';
import { NextResponse } from 'next/server';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { logger } from '@/seed/utils/logger-utility';

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

/** SSE keepalive comment line — does NOT set Last-Event-ID (per SSE spec). */
function sseHeartbeat(ts: number): string {
  return `: ping ${ts}\n\n`;
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
      return apiKeyAuthErrorResponse(auth);
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

        // ── Cursor separation (Wave-14 heartbeat-cursor fix) ───────────────
        // eventCursor: advances ONLY when a real DB status event is emitted.
        //   Used for SSE `id:` lines and reconnect dedup.
        // lastHeartbeatTs: wall-clock of last keepalive tick.
        //   NEVER written to eventCursor — prevents clock-skew dedup suppression.
        let eventCursor = resumeCursor;
        let lastHeartbeatTs = Date.now();
        // ──────────────────────────────────────────────────────────────────

        // Emit initial `id: 0` so EventSource can track from the start.
        controller.enqueue(encoder.encode(
          sseMessage('connected', { mission_id: id, resume_cursor: resumeCursor }, resumeCursor || 0)
        ));

        Sentry.addBreadcrumb({
          category: 'sse',
          message: `SSE connect mission=${id}`,
          data: { mission_id: id, resume_cursor: resumeCursor },
          level: 'info',
        });

        const isReconnect = resumeCursor > 0;
        if (isReconnect) {
          Sentry.addBreadcrumb({
            category: 'sse',
            message: `SSE reconnect mission=${id}`,
            data: { mission_id: id, resume_cursor: resumeCursor },
            level: 'info',
          });
        }

        try {
          while (Date.now() - startTime < MAX_DURATION_MS) {
            await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
            if (r.signal.aborted) break;

            const now = Date.now();

            // Keepalive: heartbeat emits `:` comment line — does NOT set Last-Event-ID.
            // lastHeartbeatTs advances; eventCursor is untouched.
            if (now - lastHeartbeatTs >= HEARTBEAT_INTERVAL_MS) {
              controller.enqueue(encoder.encode(sseHeartbeat(now)));
              lastHeartbeatTs = now;
              // eventCursor intentionally NOT updated here
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

              // Dedup check: skip if client already saw this DB state.
              // updated_at is 0/null on brand-new missions — emit those always.
              // Comparison is against eventCursor ONLY (never polluted by heartbeat).
              const dbCursor = data.updated_at ?? 0;
              if (dbCursor > 0 && dbCursor <= eventCursor) {
                // No new state since last emitted event — keep polling silently.
                if (TERMINAL_STATUSES.has(data.status)) {
                  // Terminal already delivered pre-disconnect; re-send done on reconnect.
                  controller.enqueue(encoder.encode(
                    sseMessage('done', { status: data.status }, dbCursor)
                  ));
                  break;
                }
                continue;
              }

              // Advance eventCursor to the real DB timestamp.
              eventCursor = dbCursor > 0 ? dbCursor : now;

              controller.enqueue(encoder.encode(sseMessage('status', {
                id: data.id,
                command: data.command,
                status: data.status,
                result: safeParseResult(data.result),
                error: data.error,
                credits_used: data.credits_used,
                updated_at: data.updated_at,
                completed_at: data.completed_at,
              }, eventCursor)));

              if (TERMINAL_STATUSES.has(data.status)) {
                controller.enqueue(encoder.encode(
                  sseMessage('done', { status: data.status }, eventCursor)
                ));
                break;
              }
            } catch (err) {
              Sentry.addBreadcrumb({
                category: 'sse',
                message: `SSE db error mission=${id}`,
                data: { mission_id: id, error: err instanceof Error ? err.message : String(err) },
                level: 'error',
              });
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
        } finally {
          // Log disconnect for downstream metrics (sse_disconnect event).
          logger.info('sse_disconnect', { mission_id: id, event_cursor: eventCursor });
          Sentry.addBreadcrumb({
            category: 'sse',
            message: `SSE disconnect mission=${id}`,
            data: { mission_id: id, event_cursor: eventCursor },
            level: 'info',
          });
          controller.close();
        }
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
