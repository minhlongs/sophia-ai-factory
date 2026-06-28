/**
 * Affiliate conversion notifications
 * @module land/affiliates/conversion-notifier
 */

import { notifyUserByTelegram } from '@/tree/telegram/user-notifier'

/**
 * Notify user of a new affiliate conversion earning via Telegram.
 * Bilingual VI+EN message. Fire-and-forget — never throws.
 *
 * @param userId - User who earned the commission
 * @param amount - Commission amount in USD (user's share)
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
