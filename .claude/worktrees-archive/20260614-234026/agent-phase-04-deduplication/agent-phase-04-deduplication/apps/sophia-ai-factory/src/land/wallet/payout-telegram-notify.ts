/**
 * Payout Telegram Notification Helper
 * Fire-and-forget bilingual (VI+EN) notification to user when payout is sent.
 */

import { logger } from '@/seed/utils/logger-utility';

interface UserRow {
  telegram_chat_id: string | null;
}

function getD1Binding(): D1Database | null {
  try {
    const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch {
    return null;
  }
}

/** Resolve user's Telegram chat ID from their profile (if stored). */
async function getUserTelegramChatId(userId: string): Promise<string | null> {
  try {
    const db = getD1Binding();
    if (!db) return null;
    const row = await db
      .prepare(`SELECT telegram_chat_id FROM user_profiles WHERE user_id = ? LIMIT 1`)
      .bind(userId)
      .first<UserRow>();
    return row?.telegram_chat_id ?? null;
  } catch {
    return null;
  }
}

/** Send a Telegram message to a specific chat. Best-effort — never throws. */
async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

/**
 * Notify a user that their payout has been sent.
 * Fire-and-forget — failures are logged but not propagated.
 */
export async function notifyPayoutSent(
  userId: string,
  amount: number,
  method: string,
  reference: string
): Promise<void> {
  try {
    const chatId = await getUserTelegramChatId(userId);
    if (!chatId) {
      logger.info('[payout-notify] No Telegram chat ID for user — skipping', { userId });
      return;
    }

    const shortRef = reference.length > 8 ? `...${reference.slice(-8)}` : reference;
    const methodLabel = method.replace(/_/g, ' ').toUpperCase();

    const text =
      `✅ <b>Payout sent: $${amount.toFixed(2)}</b> via ${methodLabel}\n` +
      `   Ref: <code>${shortRef}</code>\n\n` +
      `✅ <b>Đã chuyển khoản: $${amount.toFixed(2)}</b> qua ${methodLabel}\n` +
      `   Mã: <code>${shortRef}</code>`;

    await sendTelegramMessage(chatId, text);
    logger.info('[payout-notify] Notification sent', { userId, amount, method });
  } catch (err) {
    logger.warn('[payout-notify] Notification failed (non-fatal)', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
