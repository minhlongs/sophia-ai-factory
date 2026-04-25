/**
 * SSE Broadcaster
 *
 * Helpers for formatting and streaming Server-Sent Events for analytics
 */

import type { RealtimeAnalyticsSnapshot, RealtimeSSEEventType } from '@/types/analytics-realtime';

/** Interval between snapshots in milliseconds */
const SNAPSHOT_INTERVAL_MS = 10_000;

/** Heartbeat interval to keep connection alive */
const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * Format a single SSE message frame.
 * SSE spec: each message ends with double newline.
 */
export function formatSSEMessage(
  eventType: RealtimeSSEEventType,
  data: RealtimeAnalyticsSnapshot | { message: string } | null
): string {
  const json = JSON.stringify(data);
  return `event: ${eventType}\ndata: ${json}\n\n`;
}

/**
 * Format a heartbeat comment (keeps connection alive through proxies).
 */
export function formatSSEHeartbeat(): string {
  return `: heartbeat ${Date.now()}\n\n`;
}

/**
 * Create a ReadableStream that pushes analytics snapshots every 10 seconds.
 *
 * @param getSnapshot - Async function that returns a fresh snapshot
 * @param intervalMs  - Override poll interval (default: 10_000)
 */
export function createSSEStream(
  getSnapshot: () => Promise<RealtimeAnalyticsSnapshot>,
  intervalMs = SNAPSHOT_INTERVAL_MS
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  let snapshotTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      /**
       * Push one snapshot to the stream.
       */
      const pushSnapshot = async () => {
        try {
          const snapshot = await getSnapshot();
          const frame = formatSSEMessage('snapshot', snapshot);
          controller.enqueue(encoder.encode(frame));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Snapshot fetch failed';
          const frame = formatSSEMessage('error', { message: errMsg });
          controller.enqueue(encoder.encode(frame));
        }
      };

      // Send initial snapshot immediately
      await pushSnapshot();

      // Schedule periodic snapshots
      snapshotTimer = setInterval(pushSnapshot, intervalMs);

      // Schedule heartbeat to prevent proxy timeouts
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(formatSSEHeartbeat()));
        } catch {
          // Stream already closed — timers will be cleared in cancel()
        }
      }, HEARTBEAT_INTERVAL_MS);
    },

    cancel() {
      if (snapshotTimer !== null) {
        clearInterval(snapshotTimer);
        snapshotTimer = null;
      }
      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  });
}
