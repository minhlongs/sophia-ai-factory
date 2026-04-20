/**
 * Telegram SQL Rate Limiter
 * SQL-based rate limiting for Telegram bot commands
 * Replaces Redis sorted set implementation
 */

import { createServerClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'

export interface TelegramRateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

const MAX_COMMANDS_PER_MINUTE = 10
const WINDOW_SECONDS = 60

/**
 * Check Telegram rate limit using PostgreSQL function
 */
export async function checkRateLimit(
  chatId: string,
  maxCommands: number = MAX_COMMANDS_PER_MINUTE,
  windowSeconds: number = WINDOW_SECONDS
): Promise<TelegramRateLimitResult> {
  const db = createServerClient()
  const now = Date.now()

  try {
    const { data, error } = await db.rpc('check_telegram_rate_limit', {
      p_chat_id: chatId,
      p_command_type: 'command',
      p_max_requests: maxCommands,
      p_window_seconds: windowSeconds,
    })

    if (error || !data) {
      logger.error('check_telegram_rate_limit RPC error', { code: error?.code, message: error?.message })
      logger.warn('[metric] telegram_ratelimit_fail_open', {
        metric: 'telegram_ratelimit_fail_open',
        reason: 'rpc_error',
        code: error?.code,
        message: error?.message,
      })
      // Fail open
      return { allowed: true, remaining: maxCommands, resetInSeconds: windowSeconds }
    }

    const rows = data as Array<Record<string, unknown>>
    const row = rows[0]
    if (!row) {
      return { allowed: true, remaining: maxCommands, resetInSeconds: windowSeconds }
    }

    const allowed = row.allowed as boolean
    const remaining = row.remaining as number
    let resetInSeconds = windowSeconds

    if (row.oldest_timestamp) {
      const oldestTime = new Date(row.oldest_timestamp as string).getTime()
      resetInSeconds = Math.max(1, Math.ceil((oldestTime + windowSeconds * 1000 - now) / 1000))
    }

    return { allowed, remaining, resetInSeconds }
  } catch (error) {
    logger.error('Telegram SQL rate limit check failed', error instanceof Error ? error : new Error(String(error)))
    logger.warn('[metric] telegram_ratelimit_fail_open', {
      metric: 'telegram_ratelimit_fail_open',
      reason: 'exception',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    return { allowed: true, remaining: maxCommands, resetInSeconds: windowSeconds }
  }
}
