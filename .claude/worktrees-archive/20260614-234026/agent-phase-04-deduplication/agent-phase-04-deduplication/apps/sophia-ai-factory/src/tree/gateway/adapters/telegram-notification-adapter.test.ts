import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TelegramNotificationAdapter } from '@/tree/gateway/adapters/telegram-notification-adapter'
import type { CampaignOutput } from '@/tree/gateway/gateway-types'

const sampleContent: CampaignOutput = {
  campaignId: 'camp-001',
  videoUrl: 'https://example.com/video.mp4',
  title: 'Test Campaign',
  description: 'A test campaign',
  tags: ['test', 'demo'],
}

describe('TelegramNotificationAdapter', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 })),
    )
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('publish', () => {
    it('should fail when no chat ID is configured', async () => {
      const adapter = new TelegramNotificationAdapter('')

      const result = await adapter.publish(sampleContent)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No Telegram chat ID configured')
    })

    it('should send notification with correct format when chat ID is provided', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
      const adapter = new TelegramNotificationAdapter('12345')

      const result = await adapter.publish(sampleContent)

      expect(result.success).toBe(true)
      expect(result.channelId).toBe('telegram')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      // Verify message body contains campaign info
      const callArgs = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]?.body as string) as Record<string, unknown>
      expect(body.chat_id).toBe('12345')
      expect(body.parse_mode).toBe('Markdown')
      const text = body.text as string
      expect(text).toContain('camp-001')
      expect(text).toContain('Test Campaign')
    })

    it('should fail when TELEGRAM_BOT_TOKEN is not set', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN
      const adapter = new TelegramNotificationAdapter('12345')

      const result = await adapter.publish(sampleContent)

      expect(result.success).toBe(false)
    })

    it('should fail when fetch returns non-ok response', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 403 })),
      )
      const adapter = new TelegramNotificationAdapter('12345')

      const result = await adapter.publish(sampleContent)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to send Telegram notification')
    })

    it('should include tags in message when present', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
      const adapter = new TelegramNotificationAdapter('12345')

      await adapter.publish(sampleContent)

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]?.body as string) as Record<string, unknown>
      const text = body.text as string
      expect(text).toContain('#test')
      expect(text).toContain('#demo')
    })

    it('should handle content without tags gracefully', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
      const adapter = new TelegramNotificationAdapter('12345')

      const contentNoTags: CampaignOutput = { ...sampleContent, tags: [] }
      const result = await adapter.publish(contentNoTags)

      expect(result.success).toBe(true)
    })
  })

  describe('getStatus', () => {
    it('should report healthy when bot token is set', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
      const adapter = new TelegramNotificationAdapter('12345')

      const status = await adapter.getStatus()

      expect(status.channelId).toBe('telegram')
      expect(status.healthy).toBe(true)
      expect(status.queueSize).toBe(0)
    })

    it('should report unhealthy when bot token is missing', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN
      const adapter = new TelegramNotificationAdapter('12345')

      const status = await adapter.getStatus()

      expect(status.healthy).toBe(false)
    })
  })

  describe('healthCheck', () => {
    it('should return true when getMe succeeds', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
      const adapter = new TelegramNotificationAdapter('12345')

      const healthy = await adapter.healthCheck()

      expect(healthy).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/getMe',
      )
    })

    it('should return false when bot token is missing', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN
      const adapter = new TelegramNotificationAdapter('12345')

      const healthy = await adapter.healthCheck()

      expect(healthy).toBe(false)
    })

    it('should return false when getMe call fails', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockRejectedValue(new Error('Network error')),
      )
      const adapter = new TelegramNotificationAdapter('12345')

      const healthy = await adapter.healthCheck()

      expect(healthy).toBe(false)
    })
  })

  describe('constructor defaults', () => {
    it('should use env TELEGRAM_ADMIN_CHAT_ID when no chatId provided', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
      process.env.TELEGRAM_ADMIN_CHAT_ID = 'env-chat-id'
      const adapter = new TelegramNotificationAdapter()

      await adapter.publish(sampleContent)

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const body = JSON.parse(callArgs[1]?.body as string) as Record<string, unknown>
      expect(body.chat_id).toBe('env-chat-id')
    })
  })
})
