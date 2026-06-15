/**
 * DB helpers for generate-campaign Inngest function
 * @module inngest/functions/generate-campaign-db
 */

import { createServerClient, getD1 } from '@/seed/db/client'
import { sendMessage as sendTelegramMessage } from '@/tree/telegram/handlers/utils'
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

export async function notifyUserByTelegram(userId: string, message: string): Promise<void> {
  const db = createServerClient();
  const { data, error } = await db.from('user_profiles').select('telegram_chat_id, settings').eq('user_id', userId).single()

  const profile = data as {
    telegram_chat_id: string | null
    settings: { notifications?: { telegram?: { enabled?: boolean } } } | null
  } | null

  if (error || !profile?.telegram_chat_id) return
  if (profile.settings?.notifications?.telegram?.enabled !== true) return

  await sendTelegramMessage(profile.telegram_chat_id, message)
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
    const _db = getD1();
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

/**
 * Notify user of a new affiliate conversion earning via Telegram.
 * Bilingual VI+EN message. Fire-and-forget wrapper — never throws.
 *
 * @param userId - User who earned the commission
 * @param amount - Commission amount in USD (user's 70% share)
 * @param campaignId - Source campaign identifier
 */
export async function notifyConversionEarned(
  userId: string,
  amount: number,
  campaignId: string
): Promise<void> {
  const formatted = amount.toFixed(2)
  const message =
    `💰 Bạn vừa kiếm được $${formatted} USD từ campaign! / ` +
    `You earned $${formatted} USD from your campaign! (ID: ${campaignId})`
  try {
    await notifyUserByTelegram(userId, message)
  } catch {
    // Fire-and-forget — suppress errors to avoid blocking webhook response
  }
}
