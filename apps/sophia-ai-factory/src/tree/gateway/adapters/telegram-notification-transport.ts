/**
 * Telegram Bot API Transport Helper for Gateway Notification Adapter
 *
 * Protected with circuit breaker and FailureKind classification.
 * Layer: tree/gateway/adapters
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

export const CHANNEL_ID = 'telegram';
export const SERVICE_NAME = 'telegram-gateway-notify';

/**
 * Sends a Telegram message using the bot token from env.
 */
export async function sendNotification(
  chatId: string,
  text: string,
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return false;
  }

  try {
    if (!shouldAllowRequest(SERVICE_NAME)) {
      throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
    }
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      },
    );

    if (response.ok) {
      recordSuccess(SERVICE_NAME);
      return true;
    }
    const kind = classifyHttpStatus(response.status);
    recordFailure(SERVICE_NAME, kind);
    return false;
  } catch (err) {
    if (err instanceof Error && err.message.includes('[circuit-breaker]')) throw err;
    const kind = classifyError(err);
    recordFailure(SERVICE_NAME, kind);
    return false;
  }
}

/**
 * Checks if the Telegram bot connection is healthy via getMe.
 */
export async function checkTelegramBotHealth(): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  try {
    if (!shouldAllowRequest(SERVICE_NAME)) {
      throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
    }
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`,
    );
    if (response.ok) {
      recordSuccess(SERVICE_NAME);
      return true;
    }
    return false;
  } catch (err) {
    if (err instanceof Error && err.message.includes('[circuit-breaker]')) throw err;
    const kind = classifyError(err);
    recordFailure(SERVICE_NAME, kind);
    return false;
  }
}
