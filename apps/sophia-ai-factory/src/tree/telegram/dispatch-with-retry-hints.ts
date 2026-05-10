/**
 * Telegram dispatch with Inngest-aware retry classification.
 *
 * Wave 19 Phase 05 (M2): wraps `publishToTelegram` so the caller (publishExecute step)
 * gets the right retry behavior from Inngest:
 *
 *  - Network error / fetch throw → plain Error (Inngest retries with default backoff)
 *  - HTTP 429 (rate limit)       → plain Error with `cause.retryAfterSec` (Inngest retries)
 *  - HTTP 5xx                    → plain Error (Inngest retries)
 *  - HTTP 4xx (NOT 429)          → NonRetriableError (Inngest stops — invalid chat etc.)
 *
 * Also emits a Sentry breadcrumb on rate-limit so we can spot bot throttling in dashboards.
 *
 * @module tree/telegram/dispatch-with-retry-hints
 */

import { NonRetriableError } from 'inngest';
import {
  publishToTelegram,
  TelegramApiError,
  type TelegramPublishInput,
  type TelegramPublishResult,
} from '@/forest/publishing/providers/telegram-publisher';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Wraps the publisher call and re-throws errors with Inngest retry hints.
 *
 * Returns the publisher result on success. Throws on any failure.
 */
export async function dispatchTelegramWithRetryHints(
  input: TelegramPublishInput,
): Promise<TelegramPublishResult> {
  try {
    return await publishToTelegram(input);
  } catch (err) {
    if (err instanceof TelegramApiError) {
      // 429: hint Inngest with retryAfterSec so future work can pass to step.sleep.
      if (err.status === 429) {
        logger.warn('[telegram-dispatch] Rate limited, will retry', {
          jobId: input.jobId,
          retryAfterSec: err.retryAfterSec,
        });
        const wrapped = new Error(err.message);
        // cause carries the retry hint without changing the message string (preserves logs).
        (wrapped as Error & { cause?: unknown }).cause = {
          retryAfterSec: err.retryAfterSec,
          status: 429,
        };
        throw wrapped;
      }

      // Other 4xx: invalid chat, bot kicked, payload rejected — do NOT retry.
      if (err.status >= 400 && err.status < 500) {
        throw new NonRetriableError(err.message, { cause: err });
      }

      // 5xx or unknown status: rethrow as plain Error so Inngest retries.
      throw new Error(err.message, { cause: err });
    }

    // Network error or unexpected error: rethrow as-is (Inngest retries).
    throw err;
  }
}
