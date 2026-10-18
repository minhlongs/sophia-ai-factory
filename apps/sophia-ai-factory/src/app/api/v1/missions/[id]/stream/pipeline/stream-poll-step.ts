/**
 * Mission SSE Single Poll Step Helper
 *
 * Layer: app/api/v1/missions/[id]/stream/pipeline
 */

import * as Sentry from '@sentry/nextjs';
import { createServerClient } from '@/seed/db/client';
import { TERMINAL_STATUSES, type MissionRow } from './types';
import { safeParseResult, sseMessage } from './formatters';

type DbClient = ReturnType<typeof createServerClient>;

export interface PollStepContext {
  db: DbClient;
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
  id: string;
  userId: string;
  eventCursor: number;
  now: number;
}

export interface PollStepOutcome {
  shouldBreak: boolean;
  nextCursor: number;
}

export async function executeMissionPollStep({
  db,
  controller,
  encoder,
  id,
  userId,
  eventCursor,
  now,
}: PollStepContext): Promise<PollStepOutcome> {
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
      return { shouldBreak: true, nextCursor: eventCursor };
    }

    const dbCursor = data.updated_at ?? 0;
    const isUnchanged = dbCursor > 0 && dbCursor <= eventCursor;
    if (isUnchanged && TERMINAL_STATUSES.has(data.status)) {
      controller.enqueue(
        encoder.encode(sseMessage('done', { status: data.status }, dbCursor))
      );
      return { shouldBreak: true, nextCursor: eventCursor };
    }
    if (isUnchanged) {
      return { shouldBreak: false, nextCursor: eventCursor };
    }

    const nextCursor = dbCursor > 0 ? dbCursor : now;

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
          nextCursor
        )
      )
    );

    if (TERMINAL_STATUSES.has(data.status)) {
      controller.enqueue(
        encoder.encode(sseMessage('done', { status: data.status }, nextCursor))
      );
      return { shouldBreak: true, nextCursor };
    }

    return { shouldBreak: false, nextCursor };
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
    return { shouldBreak: false, nextCursor: eventCursor };
  }
}
