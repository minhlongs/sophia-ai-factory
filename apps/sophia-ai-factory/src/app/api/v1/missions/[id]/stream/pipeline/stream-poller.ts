/**
 * Mission SSE Stream Poller and Worker
 *
 * Layer: app/api/v1/missions/[id]/stream/pipeline
 */

import * as Sentry from '@sentry/nextjs';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  POLL_INTERVAL_MS,
  MAX_DURATION_MS,
  HEARTBEAT_INTERVAL_MS,
  TERMINAL_STATUSES,
  type MissionRow,
} from './types';
import { safeParseResult, sseMessage, sseHeartbeat } from './formatters';

export interface CreateMissionStreamOptions {
  id: string;
  userId: string;
  resumeCursor: number;
  signal: AbortSignal;
}

export function createMissionStream({
  id,
  userId,
  resumeCursor,
  signal,
}: CreateMissionStreamOptions): ReadableStream {
  const encoder = new TextEncoder();
  const startTime = Date.now();

  return new ReadableStream({
    async start(controller) {
      const db = createServerClient();
      let eventCursor = resumeCursor;
      let lastHeartbeatTs = Date.now();

      controller.enqueue(
        encoder.encode(
          sseMessage('connected', { mission_id: id, resume_cursor: resumeCursor }, resumeCursor || 0)
        )
      );

      Sentry.addBreadcrumb({
        category: 'sse',
        message: `SSE connect mission=${id}`,
        data: { mission_id: id, resume_cursor: resumeCursor },
        level: 'info',
      });

      if (resumeCursor > 0) {
        Sentry.addBreadcrumb({
          category: 'sse',
          message: `SSE reconnect mission=${id}`,
          data: { mission_id: id, resume_cursor: resumeCursor },
          level: 'info',
        });
      }

      try {
        while (Date.now() - startTime < MAX_DURATION_MS) {
          await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
          if (signal.aborted) break;

          const now = Date.now();

          if (now - lastHeartbeatTs >= HEARTBEAT_INTERVAL_MS) {
            controller.enqueue(encoder.encode(sseHeartbeat(now)));
            lastHeartbeatTs = now;
          }

          try {
            const { data } = (await db
              .from('engine_missions')
              .select('id, command, status, result, error, credits_used, updated_at, completed_at')
              .eq('id', id)
              .eq('user_id', userId)
              .single()) as { data: MissionRow | null; error: unknown };

            if (!data) {
              controller.enqueue(
                encoder.encode(
                  sseMessage('error', { code: 'not_found', message: 'Mission not found' }, null)
                )
              );
              break;
            }

            const dbCursor = data.updated_at ?? 0;
            const isUnchanged = dbCursor > 0 && dbCursor <= eventCursor;
            if (isUnchanged && TERMINAL_STATUSES.has(data.status)) {
              controller.enqueue(
                encoder.encode(sseMessage('done', { status: data.status }, dbCursor))
              );
              break;
            }
            if (isUnchanged) {
              continue;
            }

            eventCursor = dbCursor > 0 ? dbCursor : now;

            controller.enqueue(
              encoder.encode(
                sseMessage(
                  'status',
                  {
                    id: data.id,
                    command: data.command,
                    status: data.status,
                    result: safeParseResult(data.result),
                    error: data.error,
                    credits_used: data.credits_used,
                    updated_at: data.updated_at,
                    completed_at: data.completed_at,
                  },
                  eventCursor
                )
              )
            );

            if (TERMINAL_STATUSES.has(data.status)) {
              controller.enqueue(
                encoder.encode(sseMessage('done', { status: data.status }, eventCursor))
              );
              break;
            }
          } catch (err) {
            Sentry.addBreadcrumb({
              category: 'sse',
              message: `SSE db error mission=${id}`,
              data: { mission_id: id, error: err instanceof Error ? err.message : String(err) },
              level: 'error',
            });
            controller.enqueue(
              encoder.encode(
                sseMessage(
                  'error',
                  {
                    code: 'db_transient',
                    message: 'A temporary error occurred. Please try again.',
                  },
                  null
                )
              )
            );
          }
        }

        if (Date.now() - startTime >= MAX_DURATION_MS) {
          controller.enqueue(
            encoder.encode(
              sseMessage('timeout', { message: 'Stream closed after 5 minutes' }, null)
            )
          );
        }
      } finally {
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
}
