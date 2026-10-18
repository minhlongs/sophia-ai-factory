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
} from './types';
import { sseMessage, sseHeartbeat } from './formatters';
import { executeMissionPollStep } from './stream-poll-step';

export { executeMissionPollStep } from './stream-poll-step';

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

          const stepOutcome = await executeMissionPollStep({
            db,
            controller,
            encoder,
            id,
            userId,
            eventCursor,
            now,
          });
          eventCursor = stepOutcome.nextCursor;
          if (stepOutcome.shouldBreak) break;
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
