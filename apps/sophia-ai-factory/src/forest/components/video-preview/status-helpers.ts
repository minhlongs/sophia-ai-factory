import type { StreamEventLike } from "./types";

/** Maps campaign status strings to the active pipeline step index. */
export function statusToStepIndex(status: string): number {
  switch (status) {
    case 'processing_script':
      return 0; // scripting
    case 'processing_video':
      return 1; // tts
    case 'processing_visual':
      return 2; // visual
    case 'processing_compose':
      return 3; // compose
    case 'publishing':
      return 4; // publish
    case 'completed':
      return 5;
    case 'failed':
      return -1;
    default:
      return -1;
  }
}

/** Derives the overall pipeline status from the latest stream events. */
export function deriveStatus(
  campaignStatus: string,
  events: StreamEventLike[],
  connected: boolean,
): 'active' | 'complete' | 'error' {
  if (campaignStatus === 'failed') return 'error';
  if (campaignStatus === 'completed') return 'complete';
  // If we have a terminal stream_end event, trust its finalStatus
  const streamEnd = events.find((e) => e.type === 'stream_end');
  if (streamEnd?.finalStatus) {
    if (streamEnd.finalStatus === 'failed') return 'error';
    if (streamEnd.finalStatus === 'completed') return 'complete';
  }
  // If a terminal error event arrived, surface error
  const terminalError = events.find((e) => e.type === 'error' && e.terminal);
  if (terminalError) return 'error';
  // Connected and no terminal signal — still active
  if (connected || campaignStatus.includes('processing') || campaignStatus === 'queued') {
    return 'active';
  }
  return 'active';
}

/** Extracts the latest progress value from stream events. */
export function deriveProgress(
  events: StreamEventLike[],
  fallback: number,
): number {
  const latest = events.find((e) => e.type === 'progress_update');
  if (latest?.progress != null) return Math.min(100, Math.max(0, latest.progress));
  return fallback;
}

/** Extracts the latest status message from stream events. */
export function deriveStatusMessage(
  events: StreamEventLike[],
): string | undefined {
  const latest = events.find((e) => e.type === 'progress_update');
  if (latest?.label) return latest.label;
  const latestError = events.find((e) => e.type === 'error');
  if (latestError?.message) return latestError.message;
  return undefined;
}
