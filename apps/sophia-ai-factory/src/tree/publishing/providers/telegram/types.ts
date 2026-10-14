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

export interface TelegramSendVideoResponse {
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
 * Typed error thrown by `publishToTelegram` for classified API failures.
 */
export class TelegramApiError extends Error {
  readonly status: number;
  readonly retryAfterSec: number | null;
  readonly bodySnippet: string;

  constructor(message: string, opts: { status: number; retryAfterSec?: number | null; bodySnippet?: string }) {
    super(message);
    this.name = 'TelegramApiError';
    this.status = opts.status;
    this.retryAfterSec = opts.retryAfterSec ?? null;
    this.bodySnippet = opts.bodySnippet ?? '';
  }
}
