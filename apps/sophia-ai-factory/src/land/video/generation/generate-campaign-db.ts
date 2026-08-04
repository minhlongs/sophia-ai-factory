/**
 * DB helpers for generate-campaign Inngest function
 * @module inngest/functions/generate-campaign-db
 */

import { createServerClient } from '@/seed/db/client'
import { CampaignStatus } from '@/seed/types'
import { logger } from '@/seed/utils/logger-utility'

export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
  progress: number,
  data?: Record<string, unknown>
): Promise<void> {
  const updatePayload: Record<string, unknown> = { status, progress, updated_at: new Date().toISOString() }
  if (data?.script_content) updatePayload.script_content = data.script_content
  if (data?.audio_url) updatePayload.audio_url = data.audio_url
  if (data?.video_url) updatePayload.video_url = data.video_url
  if (data?.thumbnail_url) updatePayload.thumbnail_url = data.thumbnail_url
  if (data?.error_message) updatePayload.error_message = data.error_message

  const db = createServerClient();
  const { error } = await db.from('campaigns').update(updatePayload).eq('id', campaignId)
  if (error) throw new Error(`Failed to update status: ${(error as { message?: string }).message}`)
}

/**
 * Mark an engine_missions row as failed with error message.
 * Fire-and-forget — catches and logs DB errors so caller can always throw NonRetriableError.
 */
export async function markEngineMissionFailed(
  missionId: string,
  errorMessage: string,
): Promise<void> {
  try {
    const _db = createServerClient();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;
    const nowSec = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        'UPDATE engine_missions SET status=\'failed\', error=?1, updated_at=?2 WHERE id=?3',
      )
      .bind(errorMessage.slice(0, 500), nowSec, missionId)
      .run();
  } catch (dbErr) {
    logger.warn('[markEngineMissionFailed] DB update failed', {
      missionId,
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    })
  }
}
