/**
 * Video Publisher Helpers — SOP Feedback Cycle & OAuth Token Refresh
 * Layer: land/video/publishing
 */

import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import {
  storeCredentials,
  getClientCredentials,
  type DecryptedCredentials,
} from '@/tree/publishing/credential-manager';
import { getAdapter } from '@/tree/publishing/token-refresh-service';
import { createFeedbackCycle } from '@/tree/sop/performance-feedback-engine';
import type { VideoPublishInput } from './types';

export async function handleFeedbackCycleCreation(videoId: string): Promise<void> {
  try {
    const dbForFeedback = createServerClient();
    if (!dbForFeedback) throw new Error('D1 unavailable');
    const sopExec = await dbForFeedback
      .prepare(`SELECT id, user_id, sop_template_id FROM sop_executions WHERE id = ?1 LIMIT 1`)
      .bind(videoId)
      .first<{ id: string; user_id: string; sop_template_id: string }>();

    let executionId: string | null = null;
    let sopId: string | null = null;
    let vidUserId: string | null = null;

    if (sopExec) {
      executionId = sopExec.id;
      sopId = sopExec.sop_template_id;
      vidUserId = sopExec.user_id;
    } else {
      const campaign = await dbForFeedback
        .prepare(`SELECT id, user_id, template_id FROM campaigns WHERE id = ?1 LIMIT 1`)
        .bind(videoId)
        .first<{ id: string; user_id: string; template_id: string }>();

      if (campaign) {
        executionId = campaign.id;
        sopId = campaign.template_id;
        vidUserId = campaign.user_id;
      }
    }

    if (executionId && sopId && vidUserId) {
      await createFeedbackCycle({
        executionId,
        sopId,
        userId: vidUserId,
        publishedAt: Math.floor(Date.now() / 1000),
      });
    }
  } catch (e) {
    logger.error('publishVideo.createFeedbackCycle_failed', {
      videoId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function resolvePlatformAccessToken(
  userId: string,
  platform: VideoPublishInput['platform'],
  creds: DecryptedCredentials,
  adapter: ReturnType<typeof getAdapter>,
): Promise<string> {
  if (!creds.isExpired || !creds.refreshToken) {
    return creds.accessToken;
  }

  const clientCreds = await getClientCredentials(userId, platform);
  if (!clientCreds) {
    return creds.accessToken;
  }

  const refreshed = await adapter.refreshToken(
    clientCreds.clientId,
    clientCreds.clientSecret,
    creds.refreshToken,
  );
  await storeCredentials({
    userId,
    platform,
    accessToken: refreshed.accessToken,
    expiresIn: refreshed.expiresIn,
  });
  return refreshed.accessToken;
}
