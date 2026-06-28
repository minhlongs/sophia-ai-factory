/**
 * Telegram Video Publisher — forest/publishing layer.
 *
 * Posts a video to a user's paired Telegram chat/DM via Bot API sendVideo.
 * Uses TELEGRAM_BOT_TOKEN env var (provisioned in wrangler env).
 * Paired chat looked up from telegram_paired_chats WHERE paired_by = userId.
 *
 * Architecture note (Phase 03, Wave 16):
 *   This publisher is dispatched from publishExecute when job.provider === 'telegram'.
 *   It receives chatId directly from publishing_jobs.channel_id (stores
 *   telegram_paired_chats.chat_id as a surrogate, no FK since D1/SQLite doesn't enforce).
 *   No access_token — auth is via TELEGRAM_BOT_TOKEN env var.
 *   SSRF gap: same assertSafeVideoUrl() guard in publishExecute applies; this publisher
 *   receives the videoUrl only after that guard passes. Do not remove the guard (Wave 17).
 *
 * @module forest/publishing/providers/telegram-publisher
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { escapeMarkdownV2, truncateMarkdownV2Safely } from '@/tree/telegram/format-markdown-v2';

const TELEGRAM_API = 'https://api.telegram.org';
const TELEGRAM_CAPTION_MAX = 1024;

export interface TelegramPublishInput {
  /** publishing_jobs.id — for logging */
  jobId: string;
  /** Current user's id — to verify paired_by ownership */
  userId: string;
  /** Video URL to post. Must already pass assertSafeVideoUrl() in publishExecute. */
  videoUrl: string;
  /** Caption text (will be MarkdownV2-sanitized). Max 1024 chars for Telegram video. */
  caption?: string;
  /** Telegram chat_id from publishing_jobs.channel_id (set by distribute route). */
  chatId: string;
}

export interface TelegramPublishResult {
  /** Telegram message_id as string */
  externalPostId: string;
  /** https://t.me/<username>/<message_id> OR https://t.me/c/<channel_id>/<message_id> */
  externalUrl: string;
}

/**
 * Typed error thrown by `publishToTelegram` for classified API failures.
 *
 * Wave 19 Phase 05: lets `dispatchTelegramWithRetryHints` route 4xx → NonRetriable,
 * 429 → retry-after-aware Inngest retry, 5xx → plain retry. Preserves the original
 * message string so legacy `.toThrow('Rate limited (429)')` tests still pass.
 */
export class TelegramApiError extends Error {
  /** HTTP status from Telegram API response. */
  readonly status: number;
  /** Telegram-suggested wait (seconds) before retry. Honors body `parameters.retry_after`, falls back to `Retry-After` header. */
  readonly retryAfterSec: number | null;
  /** Raw body snippet (first 200 chars) for diagnostics. */
  readonly bodySnippet: string;

  constructor(message: string, opts: { status: number; retryAfterSec?: number | null; bodySnippet?: string }) {
    super(message);
    this.name = 'TelegramApiError';
    this.status = opts.status;
    this.retryAfterSec = opts.retryAfterSec ?? null;
    this.bodySnippet = opts.bodySnippet ?? '';
  }
}

/**
 * Sanitize caption for MarkdownV2 mode.
 *
 * Wave 20 Phase 01 (7A): switched from strip-specials to backslash-escape so user
 * captions render literally (period, brackets, exclamation no longer disappear).
 * Future v2 may parse intentional formatting pairs; for now treat as plain text.
 */
function sanitizeCaption(text: string): string {
  const escaped = escapeMarkdownV2(text.trim());
  return truncateMarkdownV2Safely(escaped, TELEGRAM_CAPTION_MAX);
}

/**
 * Mask bot token in logs: show only first 6 chars.
 * Format: bot<6chars>...
 */
function maskToken(token: string): string {
  return `bot${token.slice(0, 6)}...`;
}

interface TelegramSendVideoResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat: {
      id: number;
      username?: string;
      title?: string;
      type: string;
    };
  };
  description?: string;
  error_code?: number;
}

/**
 * Post a video to a Telegram chat via Bot API sendVideo.
 *
 * Throws on:
 *   - Missing TELEGRAM_BOT_TOKEN
 *   - chatId missing/empty
 *   - HTTP 429 (rate limit) — Inngest will retry
 *   - HTTP 401/403 (invalid token or bot not admin in channel)
 *   - Any non-ok response
 */
export async function publishToTelegram(
  input: TelegramPublishInput,
): Promise<TelegramPublishResult> {
  const { jobId, videoUrl, caption, chatId } = input;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('[telegram-publisher] TELEGRAM_BOT_TOKEN not set in environment');
  }

  if (!chatId) {
    throw new Error('[telegram-publisher] chatId is empty — pairing may have been revoked');
  }

  const safeCaption = caption ? sanitizeCaption(caption) : '';

  const payload = {
    chat_id: chatId,
    video: videoUrl,
    ...(safeCaption ? { caption: safeCaption, parse_mode: 'MarkdownV2' as const } : {}),
    supports_streaming: true,
  };

  logger.info('[telegram-publisher] sendVideo', {
    jobId,
    chatId,
    videoUrlLen: videoUrl.length,
    token: maskToken(token),
  });

  let res: Response;
  try {
    res = await fetch(`${TELEGRAM_API}/bot${token}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(`[telegram-publisher] Network error: ${getErrorMessage(err)}`);
  }

  if (res.status === 429) {
    // Rate limited — prefer body `parameters.retry_after`, fall back to header.
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
    throw new TelegramApiError(
      `[telegram-publisher] Rate limited (429). Retry-After: ${retryAfterSec}s. Token: ${maskToken(token)}`,
      { status: 429, retryAfterSec, bodySnippet: bodyText.slice(0, 200) },
    );
  }

  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '');
    throw new TelegramApiError(
      `[telegram-publisher] Auth error ${res.status} — token may be invalid or bot lacks admin rights in channel. ` +
        `Token: ${maskToken(token)}. Response: ${body.slice(0, 200)}`,
      { status: res.status, bodySnippet: body.slice(0, 200) },
    );
  }

  let data: TelegramSendVideoResponse;
  try {
    data = (await res.json()) as TelegramSendVideoResponse;
  } catch {
    const body = await res.text().catch(() => '');
    throw new TelegramApiError(
      `[telegram-publisher] Failed to parse Telegram response (HTTP ${res.status}): ${body.slice(0, 200)}`,
      { status: res.status, bodySnippet: body.slice(0, 200) },
    );
  }

  if (!data.ok || !data.result) {
    throw new TelegramApiError(
      `[telegram-publisher] Telegram API error: ${data.description ?? 'unknown'} ` +
        `(code ${data.error_code ?? res.status})`,
      { status: data.error_code ?? res.status, bodySnippet: (data.description ?? '').slice(0, 200) },
    );
  }

  const messageId = data.result.message_id;
  const chat = data.result.chat;

  // Build public URL:
  // - Public channel/group with username: https://t.me/<username>/<message_id>
  // - Private channel (numeric id, starts with -100): https://t.me/c/<channel_id_without_-100>/<message_id>
  // - DM / private chat: no public URL available, use placeholder
  let externalUrl: string;
  if (chat.username) {
    externalUrl = `https://t.me/${chat.username}/${messageId}`;
  } else if (String(chat.id).startsWith('-100')) {
    const channelNumeric = String(chat.id).replace(/^-100/, '');
    externalUrl = `https://t.me/c/${channelNumeric}/${messageId}`;
  } else {
    // DM or private group — no public URL
    externalUrl = `https://t.me/message/${messageId}`;
  }

  logger.info('[telegram-publisher] Video posted', { jobId, chatId, messageId, externalUrl });

  return {
    externalPostId: String(messageId),
    externalUrl,
  };
}
