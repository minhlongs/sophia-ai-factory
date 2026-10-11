import { logger } from '@/seed/utils/logger-utility';

/**
 * Try sending with MarkdownV2; fallback to plain text on parse failure.
 * Wave 20 Phase 01 (7A): strict escaping for all user-provided content.
 */
export async function tryFetchMarkdownV2(
  botToken: string,
  chatId: string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<Response> {
  const firstRes = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...extra,
        parse_mode: 'MarkdownV2',
      }),
    },
  );

  if (!firstRes.ok) {
    const bodyText = await firstRes.text().catch(() => '');
    // On parse failure (400 with "can't parse"), fallback to plain text.
    if (bodyText.includes("can't parse") || firstRes.status === 400) {
      logger.warn('[sendTelegramMessage] MarkdownV2 parse failed, falling back to plain text', {
        chatId,
        status: firstRes.status,
      });
      return fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, ...extra }),
        },
      );
    }
  }

  return firstRes;
}

/**
 * Helper to dispatch JSON POST request to Telegram Bot API.
 */
export async function postTelegramEndpoint(
  endpoint: string,
  botToken: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  return fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
