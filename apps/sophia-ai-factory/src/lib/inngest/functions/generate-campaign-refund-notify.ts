/**
 * Bilingual (VI+EN) refund notification helper for generate-campaign Inngest function.
 * Fired when a MissingCredentialsError is caught so the paying user is not left in silence.
 *
 * @module inngest/functions/generate-campaign-refund-notify
 */

import { notifyUserByTelegram, updateCampaignStatus } from './generate-campaign-db'
import { logger } from '@/seed/utils/logger-utility'

const SUPPORT_HANDLE = '@sophia_support'

/** Maps internal credential key names to user-friendly service labels (VI + EN). */
const SERVICE_LABEL: Record<string, { vi: string; en: string }> = {
  OPENROUTER_API_KEY:  { vi: 'tạo kịch bản', en: 'script generation' },
  ELEVENLABS_API_KEY:  { vi: 'lồng tiếng',   en: 'voiceover' },
  HEYGEN_API_KEY:      { vi: 'tạo video',    en: 'video rendering' },
  NOWPAYMENTS_API_KEY: { vi: 'thanh toán',   en: 'payment processing' },
}

/**
 * Build the bilingual refund-instruction message.
 * Uses friendly service label for user-facing text; raw key name kept only in DB error_message.
 */
function buildRefundMessage(campaignId: string, missingKey: string): string {
  const label = SERVICE_LABEL[missingKey] ?? { vi: 'dịch vụ AI', en: 'AI service' }
  return (
    `❌ Campaign tạm dừng: dịch vụ ${label.vi} chưa sẵn sàng.\n` +
    `📞 Liên hệ admin để hoàn tiền: ${SUPPORT_HANDLE}\n` +
    `ID: ${campaignId}\n` +
    `---\n` +
    `❌ Campaign halted: ${label.en} service unavailable.\n` +
    `📞 Contact admin for refund: ${SUPPORT_HANDLE}\n` +
    `ID: ${campaignId}`
  )
}

/**
 * Mark campaign as failed + send bilingual Telegram refund notice.
 * Errors are swallowed so the caller can still throw NonRetriableError cleanly.
 */
export async function notifyRefundRequired(
  userId: string,
  campaignId: string,
  missingKey: string
): Promise<void> {
  try {
    await updateCampaignStatus(campaignId, 'failed', 0, {
      error_message: `Service unavailable: ${missingKey}`,
    })
  } catch (dbErr) {
    logger.warn('[notifyRefundRequired] Failed to update campaign status', { campaignId, missingKey, error: String(dbErr) })
  }

  try {
    const message = buildRefundMessage(campaignId, missingKey)
    await notifyUserByTelegram(userId, message)
  } catch (tgErr) {
    // Log for admin daily review — user may have disabled the bot
    logger.warn('[notifyRefundRequired] Telegram notification failed', { userId, campaignId, missingKey, error: String(tgErr) })
  }
}
