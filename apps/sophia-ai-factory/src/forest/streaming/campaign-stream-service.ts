/**
 * @module campaign-stream-service
 * Service that queries D1 for campaign progress and yields SSE events.
 *
 * Designed for Cloudflare Workers: uses generator functions and
 * ReadableStream-compatible iteration — no Node.js streams API.
 *
 * Import direction: forest layer — may import seed + tree only.
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CampaignStreamEvent,
  StepCompleteEvent,
  StreamState,
} from './campaign-stream-types';

/** Default poll interval in milliseconds. */
export const DEFAULT_POLL_MS = 3_000;

/** Maximum stream duration in milliseconds (stay under CF 60 s limit). */
export const MAX_STREAM_DURATION_MS = 58_000;

/** Heartbeat interval in milliseconds. */
export const HEARTBEAT_MS = 15_000;

/** Maximum consecutive DB errors before the stream ends with an error event. */
export const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Build an SSE-encoded string.
 * Format: `data: <JSON>\n\n`
 */
export function encodeSSE(data: CampaignStreamEvent): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create the initial stream state for a campaign.
 */
export function createInitialState(): StreamState {
  const now = new Date(Date.now() - 5_000).toISOString();
  return {
    lastCheckpointAt: now,
    lastStatus: '',
    lastProgress: -1,
  };
}

/**
 * Query D1 for new campaign checkpoints since the last poll.
 */
async function fetchNewCheckpoints(
  campaignId: string,
  afterTimestamp: string,
): Promise<CampaignStreamEvent[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from('campaign_checkpoints')
    .select('step, completed_at, metadata')
    .eq('campaign_id', campaignId)
    .gt('completed_at', afterTimestamp)
    .order('completed_at', { ascending: true });

  if (error || !data) {
    logger.warn(
      '[campaign-stream] checkpoint query failed',
      error ? new Error(error.message) : undefined,
      { campaignId, afterTimestamp },
    );
    return [];
  }

  return (data as unknown as { step: string; completed_at: string; metadata: string }[])
    .filter((row) => row.completed_at > afterTimestamp)
    .map((row): StepCompleteEvent => {
      let parsedMetadata: Record<string, unknown> = {};
      try {
        parsedMetadata = JSON.parse(row.metadata) as Record<string, unknown>;
      } catch {
        parsedMetadata = { raw: row.metadata };
      }
      return {
        type: 'step_complete',
        timestamp: row.completed_at,
        campaignId,
        step: row.step,
        completedAt: row.completed_at,
        metadata: parsedMetadata,
      };
    });
}

/**
 * Query D1 for the current campaign row.
 */
async function fetchCampaign(
  campaignId: string,
): Promise<{ status: string; progress: number } | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('campaigns')
    .select('status, progress')
    .eq('id', campaignId)
    .maybeSingle();

  if (error || !data) {
    logger.warn(
      '[campaign-stream] campaign query failed',
      error ? new Error(error.message) : undefined,
      { campaignId },
    );
    return null;
  }

  return {
    status: (data as { status: string; progress: number }).status,
    progress: (data as { status: string; progress: number }).progress,
  };
}

/**
 * Build a progress_update event when progress has changed.
 */
function buildProgressEvent(
  campaignId: string,
  progress: number,
  step?: string,
): CampaignStreamEvent {
  return {
    type: 'progress_update',
    timestamp: new Date().toISOString(),
    campaignId,
    progress,
    label: `Processing… ${progress}%`,
    currentStep: step,
  };
}

/**
 * Build a status_change event when status has transitioned.
 */
function buildStatusChangeEvent(
  campaignId: string,
  previousStatus: string,
  newStatus: string,
): CampaignStreamEvent {
  return {
    type: 'status_change',
    timestamp: new Date().toISOString(),
    campaignId,
    previousStatus,
    status: newStatus,
  };
}

/**
 * Build an error event.
 */
function buildErrorEvent(
  campaignId: string,
  code: string,
  message: string,
  terminal: boolean,
): CampaignStreamEvent {
  return {
    type: 'error',
    timestamp: new Date().toISOString(),
    campaignId,
    code,
    message,
    terminal,
  };
}

/**
 * Build a heartbeat event.
 */
function buildHeartbeatEvent(campaignId: string, uptime: number): CampaignStreamEvent {
  return {
    type: 'heartbeat',
    timestamp: new Date().toISOString(),
    campaignId,
    uptime,
  };
}

/**
 * Build a stream_end event.
 */
function buildStreamEndEvent(
  campaignId: string,
  finalStatus: string,
  finalProgress: number,
): CampaignStreamEvent {
  return {
    type: 'stream_end',
    timestamp: new Date().toISOString(),
    campaignId,
    finalStatus,
    finalProgress,
  };
}

/**
 * Iterable that yields SSE events for a single campaign.
 *
 * Usage in a route handler:
 * ```ts
 * const stream = new ReadableStream({ async start(controller) {
 *   for await (const event of campaignStream(campaignId)) {
 *     controller.enqueue(encodeSSE(event));
 *   }
 * }});
 * ```
 */
export async function* campaignStream(
  campaignId: string,
): AsyncGenerator<CampaignStreamEvent, void, unknown> {
  const startedAt = Date.now();
  const state = createInitialState();
  let consecutiveErrors = 0;

  // Initial connected event
  yield {
    type: 'progress_update',
    timestamp: new Date().toISOString(),
    campaignId,
    progress: 0,
    label: 'Connecting…',
  };

  while (Date.now() - startedAt < MAX_STREAM_DURATION_MS) {
    // Heartbeat
    const uptime = Math.floor((Date.now() - startedAt) / 1_000);
    yield buildHeartbeatEvent(campaignId, uptime);

    try {
      // Fetch new checkpoints
      const checkpointEvents = await fetchNewCheckpoints(
        campaignId,
        state.lastCheckpointAt,
      );

      for (const event of checkpointEvents) {
        if (event.type === 'step_complete') {
          state.lastCheckpointAt = event.completedAt;
        }
        yield event;
      }

      // Fetch current campaign state
      const campaign = await fetchCampaign(campaignId);

      if (campaign) {
        // Status change detection
        if (campaign.status !== state.lastStatus && state.lastStatus !== '') {
          yield buildStatusChangeEvent(campaignId, state.lastStatus, campaign.status);
        }
        state.lastStatus = campaign.status;

        // Progress change detection
        if (campaign.progress !== state.lastProgress) {
          yield buildProgressEvent(campaignId, campaign.progress);
          state.lastProgress = campaign.progress;
        }

        // Terminal status — end the stream
        if (
          campaign.status === 'completed' ||
          campaign.status === 'failed' ||
          campaign.status === 'video_timeout'
        ) {
          // Emit error event for failure states before closing
          if (campaign.status === 'failed') {
            yield buildErrorEvent(
              campaignId,
              'CAMPAIGN_FAILED',
              'Campaign processing failed',
              true,
            );
          }
          yield buildStreamEndEvent(campaignId, campaign.status, campaign.progress);
          return;
        }
      }

      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      logger.error(
        '[campaign-stream] poll cycle error',
        err instanceof Error ? err : new Error(String(err)),
        { campaignId, consecutiveErrors },
      );

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        yield buildErrorEvent(
          campaignId,
          'STREAM_ERROR',
          'Too many consecutive errors — stream ending',
          true,
        );
        yield buildStreamEndEvent(campaignId, state.lastStatus || 'unknown', state.lastProgress);
        return;
      }
    }

    // Sleep until next poll — use setTimeout wrapped in Promise
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_MS));
  }

  // Timeout — stream duration exceeded
  yield buildErrorEvent(campaignId, 'STREAM_TIMEOUT', 'Stream duration limit reached', false);
  yield buildStreamEndEvent(campaignId, state.lastStatus || 'unknown', state.lastProgress);
}
