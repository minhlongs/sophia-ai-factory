/**
 * @file live-stream-actions.ts
 * @description Authenticated Server Actions for AI Live Streamer Sessions
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { LiveStreamSession, LiveStreamPlatform } from '@/seed/types/live-stream-newsjack-dm-types';

export async function createLiveStreamSessionAction(
  title: string,
  platform: LiveStreamPlatform,
  loopVideoUrl: string,
): Promise<{ success: boolean; session?: LiveStreamSession; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return { success: false, error: 'Unauthorized' };

    const sessionId = `live_${Date.now()}`;
    const db = createServerClient();
    const now = Date.now();

    db.prepare(`
      INSERT INTO live_stream_sessions (
        id, user_id, title, platform, stream_key_masked, loop_video_url,
        status, viewers_count, qa_turnaround_ms, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'IDLE', 0, 850, ?, ?)
    `).bind(
      sessionId,
      user.id,
      title,
      platform,
      'live_sec_***',
      loopVideoUrl,
      now,
      now,
    ).run();

    const session: LiveStreamSession = {
      id: sessionId,
      userId: user.id,
      title,
      platform,
      streamKeyMasked: 'live_sec_***',
      loopVideoUrl,
      status: 'IDLE',
      currentPinnedOfferId: null,
      viewersCount: 0,
      qaTurnaroundMs: 850,
      createdAt: now,
      updatedAt: now,
    };

    return { success: true, session };
  } catch (err) {
    logger.error('Failed to create live stream session', { err });
    return { success: false, error: 'Failed to create session' };
  }
}

export async function triggerLoopRefreshAction(
  sessionId: string,
  loopVideoUrl: string,
  pinnedOfferId?: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return { success: false, error: 'Unauthorized' };

    await inngest.send({
      name: 'live.stream.loop.refresh.requested',
      data: {
        userId: user.id,
        sessionId,
        loopVideoUrl,
        pinnedOfferId,
      },
    });

    return { success: true };
  } catch (err) {
    logger.error('Failed to trigger loop refresh', { err });
    return { success: false, error: 'Failed to refresh stream loop' };
  }
}
