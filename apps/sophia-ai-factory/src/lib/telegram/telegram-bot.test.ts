import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  handleStart,
  handleHelp,
  handleEmail,
  handleCampaign,
  handleStatus,
  handleResults
} from './telegram-bot'
import * as telegramClient from './telegram-client'
import { inngest } from '@/lib/inngest/client'

// Mock dependencies
const mockSupabase = vi.hoisted(() => ({
  auth: {
    admin: {
      listUsers: vi.fn()
    }
  },
  from: vi.fn()
}))

// Mock Supabase client creation
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase
}))

// Mock Inngest
vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn()
  }
}))

// Mock Telegram Client
vi.mock('./telegram-client', () => ({
  sendTelegramMessage: vi.fn()
}))

describe('Telegram Bot Handlers', () => {
  const chatId = '12345'
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key'
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('handleStart', () => {
    it('should send welcome message', async () => {
      await handleStart(chatId)
      expect(telegramClient.sendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Welcome to Sophia AI Factory Bot')
      )
    })
  })

  describe('handleHelp', () => {
    it('should send help message', async () => {
      await handleHelp(chatId)
      expect(telegramClient.sendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Sophia AI Factory Bot Commands')
      )
    })
  })

  describe('handleEmail', () => {
    it('should link user account if email exists', async () => {
      // Mock listUsers response
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [{ id: 'user-1', email: 'test@example.com' }]
        },
        error: null
      })

      // Mock user_profiles select (profile exists)
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
                data: { settings: { notifications: {} } },
                error: null
            })
        })
      })

      // Mock user_profiles update
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_profiles') {
          return {
            select: mockSelect,
            update: mockUpdate
          }
        }
        return {}
      })

      await handleEmail(chatId, 'test@example.com')

      expect(mockSupabase.auth.admin.listUsers).toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ telegram_chat_id: chatId })
      )
      expect(telegramClient.sendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Your account')
      )
    })

    it('should handle user not found', async () => {
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null
      })

      await handleEmail(chatId, 'notfound@example.com')

      expect(telegramClient.sendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Could not find an account')
      )
    })
  })

  describe('handleCampaign', () => {
    it('should create campaign and trigger inngest event', async () => {
      const topic = 'Eco gadgets'
      const userId = 'user-1'
      const campaignId = 'camp-1'

      // Mock profile check
      const mockSelectProfile = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: userId, subscription_tier: 'pro' },
            error: null
          })
        })
      })

      // Mock campaign insert
      const mockInsertCampaign = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: campaignId },
            error: null
          })
        })
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_profiles') return { select: mockSelectProfile }
        if (table === 'campaigns') return { insert: mockInsertCampaign }
        return {}
      })

      await handleCampaign(chatId, topic)

      expect(mockInsertCampaign).toHaveBeenCalledWith(expect.objectContaining({
        user_id: userId,
        title: topic,
        topic: topic
      }))

      expect(inngest.send).toHaveBeenCalledWith({
        name: "campaign.created",
        data: expect.objectContaining({
          campaignId: campaignId,
          userId: userId,
          topic: topic,
          tier: 'PREMIUM' // 'pro' maps to 'PREMIUM'
        })
      })

      expect(telegramClient.sendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Campaign Started')
      )
    })

    it('should handle unlinked account', async () => {
      // Mock profile check returning null
      const mockSelectProfile = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null // No error, just no data found
          })
        })
      })

      mockSupabase.from.mockReturnValue({ select: mockSelectProfile })

      await handleCampaign(chatId, 'topic')

      expect(telegramClient.sendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Account not linked')
      )
    })
  })

  describe('handleStatus', () => {
    it('should show active campaigns', async () => {
      const userId = 'user-1'

      // Mock profile check
      const mockSelectProfile = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: userId },
            error: null
          })
        })
      })

      // Mock campaigns fetch
      const mockSelectCampaigns = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  { title: 'Camp 1', status: 'processing_video', progress: 50 },
                  { title: 'Camp 2', status: 'queued', progress: 0 }
                ],
                error: null
              })
            })
          })
        })
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_profiles') return { select: mockSelectProfile }
        if (table === 'campaigns') return { select: mockSelectCampaigns }
        return {}
      })

      await handleStatus(chatId)

      expect(telegramClient.sendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Active Campaigns')
      )
      expect(telegramClient.sendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Camp 1')
      )
    })
  })

  describe('handleResults', () => {
    it('should show completed campaigns', async () => {
       const userId = 'user-1'

      // Mock profile check
      const mockSelectProfile = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: userId },
            error: null
          })
        })
      })

      // Mock campaigns fetch
      const mockSelectCampaigns = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    title: 'Finished Camp',
                    status: 'completed',
                    video_url: 'http://video.url',
                    updated_at: new Date().toISOString()
                  }
                ],
                error: null
              })
            })
          })
        })
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_profiles') return { select: mockSelectProfile }
        if (table === 'campaigns') return { select: mockSelectCampaigns }
        return {}
      })

      await handleResults(chatId)

      expect(telegramClient.sendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Recent Results')
      )
      expect(telegramClient.sendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('http://video.url')
      )
    })
  })
})
