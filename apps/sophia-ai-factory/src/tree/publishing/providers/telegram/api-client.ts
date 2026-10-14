import { logger } from '@/seed/utils/logger-utility';
import { recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import { TelegramApiError, type TelegramSendVideoResponse } from './types';

export const TELEGRAM_API = 'https://api.telegram.org';

export async function handleTelegramRateLimit(res: Response): Promise<never> {
  const headerRetry = Number(res.headers.get('Retry-After') ?? '');
  let bodyRetry: number | null = null;
  let bodyText = '';
  try {
    bodyText = await res.text();
    const parsed = JSON.parse(bodyText) as { parameters?: { retry_after?: number } };
    if (typeof parsed?.parameters?.retry_after === 'number') {
      bodyRetry = parsed.parameters.retry_after;
    }
  } catch {
    // ignore parse failure
  }
  const retryAfterSec = bodyRetry ?? (Number.isFinite(headerRetry) ? headerRetry : 60);
  recordFailure('telegram', classifyError(new Error('rate_limited')));
  throw new TelegramApiError(
    `[telegram-publisher] Rate limited (429). Retry-After: ${retryAfterSec}s.`,
    { status: 429, retryAfterSec, bodySnippet: bodyText.slice(0, 200) },
  );
}

export async function handleTelegramAuthError(res: Response): Promise<never> {
  const body = await res.text().catch((err) => {
    logger.warn('Failed to read Telegram 401/403 response', { error: String(err), context: 'publishToTelegram' });
    return '';
  });
  recordFailure('telegram', classifyHttpStatus(res.status));
  throw new TelegramApiError(
    `[telegram-publisher] Telegram API error: ${res.status} ${body.slice(0, 200)}`,
    { status: res.status, bodySnippet: body.slice(0, 200) },
  );
}

export async function parseTelegramResponseBody(res: Response): Promise<TelegramSendVideoResponse> {
  try {
    return (await res.json()) as TelegramSendVideoResponse;
  } catch {
    let body = '';
    try {
      body = await res.text();
    } catch (err) {
      logger.warn('[TelegramPublisher] Failed to read response body after parse failure', { error: String(err) });
    }
    recordFailure('telegram', classifyHttpStatus(res.status));
    throw new TelegramApiError(
      `[telegram-publisher] Failed to parse Telegram response: ${body.slice(0, 200) || 'empty body'}`,
      { status: res.status, bodySnippet: body.slice(0, 200) },
    );
  }
}
