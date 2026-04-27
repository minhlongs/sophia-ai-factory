/**
 * Tests for telegram-bot-campaign-handlers.ts
 * Covers: account-not-linked path, campaign insert, tier mapping (H1 fix)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleCampaign, handleStatus, handleResults } from './telegram-bot-campaign-handlers'

// -------------------------------------------------------------------------
// Mocks
// -------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('@/lib/db/client', () => ({
  createServerClient: () => mockDb,
}))

const mockInngest = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@/lib/inngest/client', () => ({
  inngest: mockInngest,
}))

const mockSendTelegramMessage = vi.fn().mockResolvedValue(undefined)

vi.mock('./telegram-client', () => ({
  sendTelegramMessage: (...args: unknown[]) => mockSendTelegramMessage(...args),
}))

// Helper: build a chainable select mock
function buildSelectMock(resolvedValue: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(resolvedValue)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, single }
}

// Helper: build a chainable insert mock
function buildInsertMock(resolvedValue: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(resolvedValue)
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  return { insert, select, single }
}

describe('telegram-bot-campaign-handlers', () => {
  const chatId = '99999'
  const topic = 'AI marketing video'

  beforeEach(() => {
    vi.resetAllMocks()
    mockInngest.send.mockResolvedValue(undefined)
    mockSendTelegramMessage.mockResolvedValue(undefined)
  })

  // -------------------------------------------------------------------------
  // C1 / H1 — Test 1: "account not linked" when user_profiles row missing
  // -------------------------------------------------------------------------
  describe('handleCampaign — account not linked', () => {
    it('returns account-not-linked message when user_profiles row missing for chat_id', async () => {
      const profileMock = buildSelectMock({ data: null, error: { message: 'Row not found' } })

      mockDb.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') return profileMock
        return {}
      })

      await handleCampaign(chatId, topic)

      expect(mockSendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Account not linked')
      )
      // Campaign insert must NOT be called
      expect(mockDb.from).not.toHaveBeenCalledWith('campaigns')
    })
  })

  // -------------------------------------------------------------------------
  // H1 — Test 2: Inserts campaign row with correct fields on valid user
  // -------------------------------------------------------------------------
  describe('handleCampaign — valid user', () => {
    it('inserts campaigns row with correct fields when valid user invokes /campaign', async () => {
      const profileData = { user_id: 'user-abc', subscription_tier: 'BASIC', telegram_chat_id: chatId }
      const profileMock = buildSelectMock({ data: profileData, error: null })

      const campaignId = 'campaign-xyz'
      const campaignMock = buildInsertMock({ data: { id: campaignId }, error: null })

      mockDb.from.mockImplementation((table: string) => {
        if (table === 'user_profiles') return profileMock
        if (table === 'campaigns') return campaignMock
        return {}
      })

      await handleCampaign(chatId, topic)

      // Insert should be called with correct base fields
      expect(campaignMock.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-abc',
          title: topic,
          topic: topic,
          status: 'queued',
          progress: 0,
        })
      )

      // Inngest event triggered
      expect(mockInngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'campaign.created',
          data: expect.objectContaining({
            userId: 'user-abc',
            topic: topic,
            tier: 'BASIC',
          }),
        })
      )

      // Success message sent
      expect(mockSendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Campaign Started')
      )
    })
  })

  // -------------------------------------------------------------------------
  // H2 — Test 3: mapSubscriptionToTier maps all 4 UPPERCASE values correctly
  // -------------------------------------------------------------------------
  describe('handleCampaign — subscription_tier UPPERCASE mapping', () => {
    const tiers: Array<{ stored: string; expected: string }> = [
      { stored: 'BASIC', expected: 'BASIC' },
      { stored: 'PREMIUM', expected: 'PREMIUM' },
      { stored: 'ENTERPRISE', expected: 'ENTERPRISE' },
      { stored: 'MASTER', expected: 'MASTER' },
    ]

    for (const { stored, expected } of tiers) {
      it(`maps subscription_tier '${stored}' → Tier '${expected}'`, async () => {
        const profileData = { user_id: `user-${stored}`, subscription_tier: stored, telegram_chat_id: chatId }
        const profileMock = buildSelectMock({ data: profileData, error: null })

        const campaignMock = buildInsertMock({ data: { id: 'camp-1' }, error: null })

        mockDb.from.mockImplementation((table: string) => {
          if (table === 'user_profiles') return profileMock
          if (table === 'campaigns') return campaignMock
          return {}
        })

        await handleCampaign(chatId, `topic for ${stored}`)

        expect(mockInngest.send).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ tier: expected }),
          })
        )
      })
    }
  })

  // -------------------------------------------------------------------------
  // handleStatus — account not linked
  // -------------------------------------------------------------------------
  describe('handleStatus', () => {
    it('returns account-not-linked when no profile found', async () => {
      const profileMock = buildSelectMock({ data: null, error: null })
      mockDb.from.mockImplementation(() => profileMock)

      await handleStatus(chatId)

      expect(mockSendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Account not linked')
      )
    })
  })

  // -------------------------------------------------------------------------
  // handleResults — account not linked
  // -------------------------------------------------------------------------
  describe('handleResults', () => {
    it('returns account-not-linked when no profile found', async () => {
      const profileMock = buildSelectMock({ data: null, error: null })
      mockDb.from.mockImplementation(() => profileMock)

      await handleResults(chatId)

      expect(mockSendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Account not linked')
      )
    })
  })
})
