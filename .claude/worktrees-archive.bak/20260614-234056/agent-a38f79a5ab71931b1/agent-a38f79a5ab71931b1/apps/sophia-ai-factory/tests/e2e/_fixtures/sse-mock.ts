/**
 * sse-mock.ts — Playwright route interceptor for mission SSE stream.
 *
 * Intercepts GET /api/v1/missions/{id}/stream and responds with a
 * synthetic SSE sequence that ends in status=succeeded within ~300ms.
 *
 * Usage:
 *   import { mockSseStream } from './_fixtures/sse-mock';
 *   await mockSseStream(page, 'mission-id-here', 'https://r2.example.com/video.mp4');
 *
 * SSE format mirrors the real route (stream/route.ts):
 *   event: connected  — initial handshake
 *   event: status     — running → succeeded with output_video_url
 *   event: done       — terminal event
 */

import type { Page } from '@playwright/test';

export interface SseMockOptions {
  /** Override the R2 URL emitted in the succeeded event */
  videoUrl?: string;
  /** Delay between events in ms (default: 100) */
  delayMs?: number;
}

const DEFAULT_VIDEO_URL =
  'https://pub-e2e-mock.r2.cloudflarestorage.com/e2e-videos/output.mp4';

/**
 * Install a Playwright route handler that intercepts:
 *   GET /api/v1/missions/<missionId>/stream
 * and responds with a synthetic SSE sequence ending in status=succeeded.
 *
 * Returns when the route handler is registered (not when the SSE closes).
 */
export async function mockSseStream(
  page: Page,
  missionId: string,
  opts: SseMockOptions = {},
): Promise<void> {
  const videoUrl = opts.videoUrl ?? DEFAULT_VIDEO_URL;
  const delayMs = opts.delayMs ?? 100;
  const now = Date.now();

  // Build SSE body synchronously — Playwright's route.fulfill() requires the
  // full body upfront; it cannot stream incrementally. We encode all events
  // in one body so the client EventSource receives them in rapid sequence.
  function event(name: string, data: unknown, id: number | null = null): string {
    const idLine = id !== null ? `id: ${id}\n` : '';
    return `${idLine}event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  const sseBody = [
    event('connected', { mission_id: missionId, resume_cursor: 0 }, 0),
    event('status', {
      id: missionId,
      command: 'video.generate',
      status: 'running',
      result: null,
      error: null,
      credits_used: 0,
      updated_at: now,
      completed_at: null,
    }, now),
    event('status', {
      id: missionId,
      command: 'video.generate',
      status: 'succeeded',
      result: { output_video_url: videoUrl },
      output_video_url: videoUrl,
      error: null,
      credits_used: 10,
      updated_at: now + delayMs,
      completed_at: now + delayMs,
    }, now + delayMs),
    event('done', { status: 'succeeded' }, now + delayMs),
  ].join('');

  await page.route(
    `**/api/v1/missions/${missionId}/stream`,
    async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
        body: sseBody,
      });
    },
  );
}

/**
 * Install a wildcard SSE mock that matches any mission ID.
 * Useful when the mission ID is generated server-side and unknown at mock time.
 */
export async function mockSseStreamWildcard(
  page: Page,
  opts: SseMockOptions = {},
): Promise<void> {
  const videoUrl = opts.videoUrl ?? DEFAULT_VIDEO_URL;
  const now = Date.now();

  function event(name: string, data: unknown, id: number | null = null): string {
    const idLine = id !== null ? `id: ${id}\n` : '';
    return `${idLine}event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  await page.route(
    '**/api/v1/missions/*/stream',
    async (route) => {
      // Extract missionId from URL for the event payload
      const url = route.request().url();
      const match = url.match(/\/missions\/([^/]+)\/stream/);
      const missionId = match?.[1] ?? 'unknown-mission';

      const sseBody = [
        event('connected', { mission_id: missionId, resume_cursor: 0 }, 0),
        event('status', {
          id: missionId,
          command: 'video.generate',
          status: 'running',
          result: null,
          error: null,
          credits_used: 0,
          updated_at: now,
          completed_at: null,
        }, now),
        event('status', {
          id: missionId,
          command: 'video.generate',
          status: 'succeeded',
          result: { output_video_url: videoUrl },
          output_video_url: videoUrl,
          error: null,
          credits_used: 10,
          updated_at: now + 100,
          completed_at: now + 100,
        }, now + 100),
        event('done', { status: 'succeeded' }, now + 100),
      ].join('');

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
        body: sseBody,
      });
    },
  );
}
