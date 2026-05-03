import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleStart,
  handleHelp,
  handleEmail,
  handleCampaign,
  handleStatus,
  handleResults
} from '@/tree/telegram/telegram-command-handlers'
import { bot } from '@/tree/telegram/telegram-bot-instance'
import { TelegramFSM, BotState } from '@/tree/telegram/telegram-fsm-state-manager'

// Mock dependencies
const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null })
}))

// Helper for chainable mocks
const createChainableMock = () => {
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }
  return mock
}

// Mock D1 shim client creation
vi.mock('@/seed/db/client', () => ({
  createServerClient: () => mockSupabase,
  createClient: () => mockSupabase,
}))

// Mock Inngest
vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn()
  }
}))

// Mock Telegram Bot Instance
vi.mock('./telegram-bot-instance', () => ({
  bot: {
    telegram: {
      sendMessage: vi.fn()
    }
  }
}))

// Mock Telegram FSM
vi.mock('./telegram-fsm-state-manager', () => ({
  TelegramFSM: {
    clearContext: vi.fn(),
    setState: vi.fn(),
    setContext: vi.fn(),
    getContext: vi.fn()
  },
  BotState: {
    IDLE: 'IDLE',
    AWAITING_EMAIL: 'AWAITING_EMAIL',
    AWAITING_CAMPAIGN_TOPIC: 'AWAITING_CAMPAIGN_TOPIC'
  }
}))

describe('Telegram Bot Handlers', () => {
  const chatId = '12345'

  beforeEach(() => {
    vi.resetAllMocks()
    // Reset the rpc mock with proper return value
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
  })

  describe('handleStart', () => {
    it('should send welcome message and clear state', async () => {
      await handleStart(chatId)
      expect(TelegramFSM.clearContext).toHaveBeenCalledWith(chatId)
      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Welcome to Sophia AI Factory'),
        expect.any(Object)
      )
    })
  })

  describe('handleHelp', () => {
    it('should send help message', async () => {
      await handleHelp(chatId)
      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Available Commands'),
        expect.any(Object)
      )
    })
  })

  describe('handleEmail', () => {
    it('should link user account if email exists', async () => {
      // Mock users table lookup (replaces auth.admin.listUsers)
      const mockUserSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-1', email: 'test@example.com' },
            error: null
          })
        })
      })

      // Mock user_profiles select (profile exists)
      const mockProfileSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: 'user-1' },
            error: null
          })
        })
      })

      // Mock user_profiles update
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return { select: mockUserSelect }
        if (table === 'user_profiles') return { select: mockProfileSelect, update: mockUpdate }
        return createChainableMock()
      })

      await handleEmail(chatId, 'test@example.com')

      expect(mockUserSelect).toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ telegram_chat_id: chatId })
      )
      expect(TelegramFSM.setContext).toHaveBeenCalledWith(chatId, expect.objectContaining({ email: 'test@example.com', state: BotState.IDLE }))
      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Success'),
        expect.any(Object)
      )
    })

    it('should handle user not found', async () => {
      // Mock users table returning no result
      const mockUserSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'User not found' }
          })
        })
      })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return { select: mockUserSelect }
        return createChainableMock()
      })

      await handleEmail(chatId, 'notfound@example.com')

      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Error verifying account'),
        expect.any(Object)
      )
    })
  })

  describe('handleCampaign', () => {
    it('should set context and ask for confirmation', async () => {
      const testTopic = 'Eco gadgets';

      (TelegramFSM.getContext as any).mockResolvedValue({ email: 'test@example.com', state: BotState.IDLE })

      await handleCampaign(chatId, testTopic)

      expect(TelegramFSM.setContext).toHaveBeenCalledWith(chatId, expect.objectContaining({
        campaignTopic: testTopic,
        state: BotState.AWAITING_CONFIRMATION
      }))

      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Campaign Preview'),
        expect.any(Object)
      )
    })

    it('should handle missing email', async () => {
      (TelegramFSM.getContext as any).mockResolvedValue(null)

      await handleCampaign(chatId, 'topic')

      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Please set your email first'),
        expect.any(Object)
      )
    })
  })

  describe('handleStatus', () => {
    it('should show active campaigns', async () => {
      const testUserId = 'user-1';

      (TelegramFSM.getContext as any).mockResolvedValue({ email: 'test@example.com', state: BotState.IDLE })

      // Mock profile check
      const mockSelectProfile = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: testUserId },
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
        return createChainableMock()
      })

      await handleStatus(chatId)

      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Your Status'),
        expect.any(Object)
      )
      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Camp 1'),
        expect.any(Object)
      )
    })
  })


  describe('handleResults', () => {
    it('should show completed campaigns', async () => {
       const testUserId = 'user-1'

      // Mock profile check
      const mockSelectProfile = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: testUserId },
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
        return createChainableMock()
      })

      await handleResults(chatId)

      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Recent Results'),
        expect.any(Object)
      )
    })
  })
})

