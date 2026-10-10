/**
 * SSE event encoding and payload builders for campaign streams.
 * @module forest/streaming/campaign/stream-broadcaster
 */

import type {
  CampaignStreamEvent,
  StreamState,
} from './types';

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
 * Build a progress_update event when progress has changed.
 */
export function buildProgressEvent(
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
export function buildStatusChangeEvent(
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
export function buildErrorEvent(
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
export function buildHeartbeatEvent(campaignId: string, uptime: number): CampaignStreamEvent {
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
export function buildStreamEndEvent(
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
