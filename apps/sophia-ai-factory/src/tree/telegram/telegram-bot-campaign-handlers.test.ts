/**
 * Tests for telegram-bot-campaign-handlers.ts
 * Covers: FSM start, status, results handlers
 * Note: handleCampaign now delegates to FSM — tests verify FSM delegation behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleCampaign, handleStatus, handleResults, handleFsmTextInput, handleOfferCallback, handleConfirmCommand } from '@/tree/telegram/telegram-bot-campaign-handlers'

// -------------------------------------------------------------------------
// Mocks
// -------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => mockDb,
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}))

const mockSendTelegramMessage = vi.fn().mockResolvedValue(undefined)
const mockSendTelegramMessageWithKeyboard = vi.fn().mockResolvedValue(undefined)

vi.mock('./telegram-client', () => ({
  sendTelegramMessage: (...args: unknown[]) => mockSendTelegramMessage(...args),
  sendTelegramMessageWithKeyboard: (...args: unknown[]) => mockSendTelegramMessageWithKeyboard(...args),
}))

vi.mock('./telegram-fsm-state-manager', () => ({
  TelegramFSM: {
    getContext: vi.fn().mockResolvedValue(null),
    setContext: vi.fn().mockResolvedValue(undefined),
    mergeContext: vi.fn().mockResolvedValue(undefined),
    clearContext: vi.fn().mockResolvedValue(undefined),
    setState: vi.fn().mockResolvedValue(undefined),
  },
  BotState: {
    IDLE: 'idle',
    AWAITING_EMAIL: 'awaiting_email',
    AWAITING_CAMPAIGN_TOPIC: 'awaiting_campaign_topic',
    AWAITING_CONFIRMATION: 'awaiting_confirmation',
    AWAITING_SUBSCRIPTION: 'awaiting_subscription',
    DISCOVERING_TRENDS: 'discovering_trends',
    CREATING_CAMPAIGN: 'creating_campaign',
    EXPORTING_CAMPAIGN: 'exporting_campaign',
  },
  isBotState: vi.fn().mockReturnValue(true),
}))

vi.mock('./telegram-bot-campaign-fsm', () => ({
  startCampaignFsm: vi.fn().mockResolvedValue(undefined),
  handleTopicInput: vi.fn().mockResolvedValue(undefined),
  handleAudienceInput: vi.fn().mockResolvedValue(undefined),
  handleOfferSelection: vi.fn().mockResolvedValue(undefined),
  handleCampaignConfirm: vi.fn().mockResolvedValue(undefined),
}))

// Helper: build a chainable select mock
function buildSelectMock(resolvedValue: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(resolvedValue)
  const in_ = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: resolvedValue.data, error: resolvedValue.error }) }) })
  const eq = vi.fn().mockReturnValue({ single, in: in_, order: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(resolvedValue) }) }) })
  const select = vi.fn().mockReturnValue({ eq, in: in_ })
  return { select, eq, single, in: in_ }
}

describe('telegram-bot-campaign-handlers', () => {
  const chatId = '99999'
  const topic = 'AI marketing video'

  beforeEach(() => {
    vi.resetAllMocks()
    mockSendTelegramMessage.mockResolvedValue(undefined)
    mockSendTelegramMessageWithKeyboard.mockResolvedValue(undefined)
  })

  // -------------------------------------------------------------------------
  // handleCampaign — now delegates to FSM
  // -------------------------------------------------------------------------
  describe('handleCampaign — FSM delegation', () => {
    it('calls startCampaignFsm with chatId', async () => {
      const { startCampaignFsm } = await import('./telegram-bot-campaign-fsm')
      await handleCampaign(chatId, topic)
      expect(startCampaignFsm).toHaveBeenCalledWith(chatId)
    })

    it('sends error message if FSM throws', async () => {
      const { startCampaignFsm } = await import('./telegram-bot-campaign-fsm')
      vi.mocked(startCampaignFsm).mockRejectedValueOnce(new Error('FSM error'))

      await handleCampaign(chatId, topic)

      expect(mockSendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('unexpected error')
      )
    })
  })

  // -------------------------------------------------------------------------
  // handleFsmTextInput
  // -------------------------------------------------------------------------
  describe('handleFsmTextInput', () => {
    it('returns false when no FSM context exists', async () => {
      const { TelegramFSM } = await import('./telegram-fsm-state-manager')
      vi.mocked(TelegramFSM.getContext).mockResolvedValueOnce(null)

      const handled = await handleFsmTextInput(chatId, 'some text')
      expect(handled).toBe(false)
    })

    it('routes to handleTopicInput when state is AWAITING_CAMPAIGN_TOPIC', async () => {
      const { TelegramFSM, BotState } = await import('./telegram-fsm-state-manager')
      vi.mocked(TelegramFSM.getContext).mockResolvedValueOnce({
        state: BotState.AWAITING_CAMPAIGN_TOPIC,
        lastUpdated: Date.now(),
      })
      const { handleTopicInput } = await import('./telegram-bot-campaign-fsm')

      const handled = await handleFsmTextInput(chatId, 'weight loss')
      expect(handled).toBe(true)
      expect(handleTopicInput).toHaveBeenCalledWith(chatId, 'weight loss')
    })

    it('routes to handleAudienceInput when state is AWAITING_CONFIRMATION (audience step)', async () => {
      const { TelegramFSM, BotState } = await import('./telegram-fsm-state-manager')
      vi.mocked(TelegramFSM.getContext).mockResolvedValueOnce({
        state: BotState.AWAITING_CONFIRMATION,
        lastUpdated: Date.now(),
      })
      const { handleAudienceInput } = await import('./telegram-bot-campaign-fsm')

      const handled = await handleFsmTextInput(chatId, 'women 25-45')
      expect(handled).toBe(true)
      expect(handleAudienceInput).toHaveBeenCalledWith(chatId, 'women 25-45')
    })

    it('returns false for unhandled FSM state', async () => {
      const { TelegramFSM, BotState } = await import('./telegram-fsm-state-manager')
      vi.mocked(TelegramFSM.getContext).mockResolvedValueOnce({
        state: BotState.IDLE,
        lastUpdated: Date.now(),
      })

      const handled = await handleFsmTextInput(chatId, 'random text')
      expect(handled).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // handleOfferCallback
  // -------------------------------------------------------------------------
  describe('handleOfferCallback', () => {
    it('returns false for non-offer callback data', async () => {
      const handled = await handleOfferCallback(chatId, 'cancel_flow')
      expect(handled).toBe(false)
    })

    it('calls handleOfferSelection for offer_ callback', async () => {
      const { handleOfferSelection } = await import('./telegram-bot-campaign-fsm')
      const handled = await handleOfferCallback(chatId, 'offer_phenq')
      expect(handled).toBe(true)
      expect(handleOfferSelection).toHaveBeenCalledWith(chatId, 'offer_phenq')
    })
  })

  // -------------------------------------------------------------------------
  // handleConfirmCommand
  // -------------------------------------------------------------------------
  describe('handleConfirmCommand', () => {
    it('calls handleCampaignConfirm', async () => {
      const { handleCampaignConfirm } = await import('./telegram-bot-campaign-fsm')
      await handleConfirmCommand(chatId)
      expect(handleCampaignConfirm).toHaveBeenCalledWith(chatId)
    })

    it('sends error message if confirm throws', async () => {
      const { handleCampaignConfirm } = await import('./telegram-bot-campaign-fsm')
      vi.mocked(handleCampaignConfirm).mockRejectedValueOnce(new Error('confirm error'))

      await handleConfirmCommand(chatId)

      expect(mockSendTelegramMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('unexpected error')
      )
    })
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

  // -------------------------------------------------------------------------
  // C2: FSM context merge — mergeContext preserves prior fields across steps
  // -------------------------------------------------------------------------
  describe('FSM context merge (C2)', () => {
    it('handleFsmTextInput routes AWAITING_CAMPAIGN_TOPIC → calls handleTopicInput (merge-safe)', async () => {
      const { TelegramFSM, BotState } = await import('./telegram-fsm-state-manager')
      vi.mocked(TelegramFSM.getContext).mockResolvedValueOnce({
        state: BotState.AWAITING_CAMPAIGN_TOPIC,
        lastUpdated: Date.now(),
      })
      const { handleTopicInput } = await import('./telegram-bot-campaign-fsm')

      const handled = await handleFsmTextInput(chatId, 'weight loss')
      expect(handled).toBe(true)
      expect(handleTopicInput).toHaveBeenCalledWith(chatId, 'weight loss')
    })

    it('handleFsmTextInput routes AWAITING_CONFIRMATION → calls handleAudienceInput (merge-safe)', async () => {
      const { TelegramFSM, BotState } = await import('./telegram-fsm-state-manager')
      vi.mocked(TelegramFSM.getContext).mockResolvedValueOnce({
        state: BotState.AWAITING_CONFIRMATION,
        lastUpdated: Date.now(),
      })
      const { handleAudienceInput } = await import('./telegram-bot-campaign-fsm')

      const handled = await handleFsmTextInput(chatId, 'women 30+')
      expect(handled).toBe(true)
      expect(handleAudienceInput).toHaveBeenCalledWith(chatId, 'women 30+')
    })

    it('handleOfferCallback routes offer_* → calls handleOfferSelection (merge-safe)', async () => {
      const { handleOfferSelection } = await import('./telegram-bot-campaign-fsm')
      const handled = await handleOfferCallback(chatId, 'offer_phenq')
      expect(handled).toBe(true)
      expect(handleOfferSelection).toHaveBeenCalledWith(chatId, 'offer_phenq')
    })
  })
})
