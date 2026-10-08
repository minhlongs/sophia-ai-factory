/**
 * @file live-stream-loop-job.ts
 * @description Inngest background job managing Cloudflare Stream RTMP loop playlisting
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';

export const liveStreamLoopJob = inngest.createFunction(
  { id: 'live-stream-loop-job', name: 'Live Stream Loop Playlist Refresh' },
  { event: 'live.stream.loop.refresh.requested' },
  async ({ event, step }) => {
    const { userId, sessionId, loopVideoUrl, pinnedOfferId } = event.data;

    await step.run('refresh-stream-state', async () => {
      const db = createServerClient();
      db.prepare(`
        UPDATE live_stream_sessions
        SET loop_video_url = ?, current_pinned_offer_id = ?, status = 'BROADCASTING', updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(
        loopVideoUrl,
        pinnedOfferId ?? null,
        Date.now(),
        sessionId,
        userId,
      ).run();

      return { sessionId, status: 'BROADCASTING', pinnedOfferId };
    });

    return { success: true, sessionId };
  },
);
