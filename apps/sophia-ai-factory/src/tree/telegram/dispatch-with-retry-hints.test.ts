/**
 * Tests for dispatchTelegramWithRetryHints — Inngest retry classification.
 *
 * Telegram bot dispatch is a PROTECTED FLOW per CLAUDE.md. The retry contract
 * must be exact: 429 → RetryAfterError, other 4xx → NonRetriableError, 5xx →
 * plain Error, network → rethrow. These tests pin that contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NonRetriableError, RetryAfterError } from 'inngest'

vi.mock('@/tree/publishing/providers/telegram-publisher', async () => {
  const actual = await vi.importActual<typeof import('@/tree/publishing/providers/telegram-publisher')>(
    '@/tree/publishing/providers/telegram-publisher'
  )
  return {
    ...actual,
    publishToTelegram: vi.fn(),
  }
})

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { dispatchTelegramWithRetryHints } from './dispatch-with-retry-hints'
import {
  publishToTelegram,
  TelegramApiError,
  type TelegramPublishInput,
} from '@/tree/publishing/providers/telegram-publisher'
import { logger } from '@/seed/utils/logger-utility'

const mockPublish = vi.mocked(publishToTelegram)
const mockLogger = vi.mocked(logger)

const baseInput: TelegramPublishInput = {
  jobId: 'job-123',
  userId: 'user-abc',
  videoUrl: 'https://example.com/video.mp4',
  chatId: '-1001234567890',
}

describe('dispatchTelegramWithRetryHints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns publisher result on success', async () => {
    mockPublish.mockResolvedValue({
      externalPostId: '42',
      externalUrl: 'https://t.me/c/1234567890/42',
    })

    const result = await dispatchTelegramWithRetryHints(baseInput)

    expect(result).toEqual({
      externalPostId: '42',
      externalUrl: 'https://t.me/c/1234567890/42',
    })
    expect(mockPublish).toHaveBeenCalledWith(baseInput)
  })

  describe('429 rate limit', () => {
    it('throws RetryAfterError with Telegram-supplied retryAfterSec', async () => {
      const apiErr = new TelegramApiError('Rate limited (429)', {
        status: 429,
        retryAfterSec: 30,
      })
      mockPublish.mockRejectedValue(apiErr)

      await expect(dispatchTelegramWithRetryHints(baseInput)).rejects.toBeInstanceOf(
        RetryAfterError
      )
    })

    it('falls back to DEFAULT_RETRY_AFTER_SEC (60) when retryAfterSec is null', async () => {
      const apiErr = new TelegramApiError('Rate limited (429)', {
        status: 429,
        retryAfterSec: null,
      })
      mockPublish.mockRejectedValue(apiErr)

      try {
        await dispatchTelegramWithRetryHints(baseInput)
        expect.fail('should have thrown')
      } catch (err) {
        const cause = (err as Error & { cause?: { retryAfterSec?: number } }).cause
        expect(cause?.retryAfterSec).toBe(60)
      }
    })

    it('attaches diagnostic cause with retryAfterSec/status/original', async () => {
      const apiErr = new TelegramApiError('Too Many Requests', {
        status: 429,
        retryAfterSec: 15,
      })
      mockPublish.mockRejectedValue(apiErr)

      try {
        await dispatchTelegramWithRetryHints(baseInput)
        expect.fail('should have thrown')
      } catch (err) {
        const cause = (err as Error & { cause?: { retryAfterSec: number; status: number; original: unknown } }).cause
        expect(cause).toMatchObject({
          retryAfterSec: 15,
          status: 429,
          original: apiErr,
        })
      }
    })

    it('logs warn with jobId + retryAfterSec on 429', async () => {
      const apiErr = new TelegramApiError('Rate limited', {
        status: 429,
        retryAfterSec: 20,
      })
      mockPublish.mockRejectedValue(apiErr)

      await expect(dispatchTelegramWithRetryHints(baseInput)).rejects.toBeDefined()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[telegram-dispatch] Rate limited, will retry',
        { jobId: 'job-123', retryAfterSec: 20 }
      )
    })
  })

  describe('non-429 4xx errors (non-retriable)', () => {
    it.each([400, 401, 403, 404, 499])(
      'throws NonRetriableError for status %i',
      async (status) => {
        const apiErr = new TelegramApiError(`HTTP ${status}`, { status })
        mockPublish.mockRejectedValue(apiErr)

        await expect(dispatchTelegramWithRetryHints(baseInput)).rejects.toBeInstanceOf(
          NonRetriableError
        )
      }
    )

    it('preserves original error on cause for 4xx', async () => {
      const apiErr = new TelegramApiError('Chat not found', { status: 400 })
      mockPublish.mockRejectedValue(apiErr)

      try {
        await dispatchTelegramWithRetryHints(baseInput)
        expect.fail('should have thrown')
      } catch (err) {
        expect((err as Error & { cause?: unknown }).cause).toBe(apiErr)
      }
    })
  })

  describe('5xx server errors (retriable)', () => {
    it.each([500, 502, 503, 504])(
      'rethrows as plain Error for status %i (not NonRetriable, not RetryAfter)',
      async (status) => {
        const apiErr = new TelegramApiError(`HTTP ${status}`, { status })
        mockPublish.mockRejectedValue(apiErr)

        try {
          await dispatchTelegramWithRetryHints(baseInput)
          expect.fail('should have thrown')
        } catch (err) {
          expect(err).toBeInstanceOf(Error)
          expect(err).not.toBeInstanceOf(NonRetriableError)
          expect(err).not.toBeInstanceOf(RetryAfterError)
        }
      }
    )

    it('preserves original error on cause for 5xx', async () => {
      const apiErr = new TelegramApiError('Bad Gateway', { status: 502 })
      mockPublish.mockRejectedValue(apiErr)

      try {
        await dispatchTelegramWithRetryHints(baseInput)
        expect.fail('should have thrown')
      } catch (err) {
        expect((err as Error & { cause?: unknown }).cause).toBe(apiErr)
      }
    })
  })

  describe('non-TelegramApiError (network/unexpected)', () => {
    it('rethrows network errors as-is for Inngest default retry', async () => {
      const networkErr = new TypeError('fetch failed')
      mockPublish.mockRejectedValue(networkErr)

      await expect(dispatchTelegramWithRetryHints(baseInput)).rejects.toBe(networkErr)
    })

    it('rethrows generic Errors as-is', async () => {
      const genericErr = new Error('something else')
      mockPublish.mockRejectedValue(genericErr)

      await expect(dispatchTelegramWithRetryHints(baseInput)).rejects.toBe(genericErr)
    })
  })
})
