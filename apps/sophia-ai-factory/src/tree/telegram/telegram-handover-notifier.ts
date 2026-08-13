/**
 * Telegram Handover Notifier
 *
 * Sends a bilingual welcome DM to the user's paired Telegram chat when they
 * activate a tier via the handover / FREE100 promo flow.
 *
 * Idempotency: caller's responsibility — this function always attempts to send.
 *
 * @note Caller in /api/promo/redeem-free should look up the paired chat from
 *       the telegram_paired_chats table and call this function.
 *       Wiring is done separately by Phase 2A agent (owns redeem-free/route.ts).
 *
 * Prerequisites:
 *   - TELEGRAM_BOT_TOKEN must be set in env
 *   - The user must have paired their Telegram account before this is called
 *     (check telegram_paired_chats table for a valid chat_id)
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { logger } from '@/seed/utils/logger-utility';
import { Tier } from '@/seed/types';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Send a bilingual welcome DM to a Telegram chat after tier activation.
 *
 * @param telegramChatId - Telegram chat ID (from telegram_paired_chats table)
 * @param magicLink      - One-time activation / login link for the user
 * @param tier           - Activated tier (e.g. 'MASTER')
 */
export async function sendHandoverTelegramDm(
  telegramChatId: string,
  magicLink: string,
  tier: Tier,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn('[telegram-handover] TELEGRAM_BOT_TOKEN not set — DM skipped', {
      chatId: telegramChatId,
      tier,
    });
    return;
  }

  const tierLabel = tier.charAt(0) + tier.slice(1).toLowerCase(); // e.g. "Master"

  const text =
    `🎉 Chào mừng bạn đến với Sophia tier *${tierLabel}*!\n` +
    `Kích hoạt tài khoản: ${magicLink}\n\n` +
    `🎉 Welcome to Sophia *${tierLabel}* tier!\n` +
    `Activate your account: ${magicLink}`;

  try {
    const response = await fetch(
      `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text,
          parse_mode: 'Markdown',
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch((err) => {
        logger.warn('Failed to read response body', { error: String(err), context: 'sendHandoverTelegramDm' });
        return '';
      });
      logger.error('[telegram-handover] Telegram API error', {
        status: response.status,
        body,
        chatId: telegramChatId,
        tier,
      });
      return;
    }

    logger.info('[telegram-handover] Welcome DM sent', { chatId: telegramChatId, tier });
  } catch (err) {
    // Non-fatal: user can still log in via email / magic link
    logger.error('[telegram-handover] Failed to send DM (non-fatal)', {
      chatId: telegramChatId,
      tier,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
