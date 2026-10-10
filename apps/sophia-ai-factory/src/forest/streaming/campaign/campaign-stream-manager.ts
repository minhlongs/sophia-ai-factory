/**
 * Campaign stream manager querying D1 and yielding SSE events.
 * Designed for Cloudflare Workers: generator functions and ReadableStream compatible.
 * @module forest/streaming/campaign/campaign-stream-manager
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  DEFAULT_POLL_MS,
  MAX_STREAM_DURATION_MS,
  MAX_CONSECUTIVE_ERRORS,
  type CampaignStreamEvent,
} from './types';
import {
  createInitialState,
  buildProgressEvent,
  buildStatusChangeEvent,
  buildErrorEvent,
  buildHeartbeatEvent,
  buildStreamEndEvent,
} from './stream-broadcaster';
import { fetchNewCheckpoints, fetchCampaign } from './campaign-queries';

/**
 * Iterable that yields SSE events for a single campaign.
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
