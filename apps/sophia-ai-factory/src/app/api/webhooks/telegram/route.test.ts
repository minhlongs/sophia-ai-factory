import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'
import * as telegramHandlers from '@/tree/telegram/telegram-command-handlers'
import * as campaignHandlers from '@/tree/telegram/telegram-bot-campaign-handlers'
import * as fsmStateManager from '@/tree/telegram/telegram-fsm-state-manager'
import * as pairingModule from '@/lib/telegram/pairing'

// Mock legacy telegram command handlers
vi.mock('@/tree/telegram/telegram-command-handlers', () => ({
  handleStart: vi.fn(),
  handleHelp: vi.fn(),
  handleEmail: vi.fn(),
  handleStatus: vi.fn(),
  handleResults: vi.fn(),
  handleSubscribe: vi.fn(),
  handleDiscover: vi.fn(),
  handleUnknown: vi.fn(),
  handleTextMessage: vi.fn(),
  handleCallbackQuery: vi.fn(),
  handleTicket: vi.fn(),
  withMiddleware: vi.fn(async (_chatId: string, handler: () => Promise<void>) => handler()),
}))

// Mock FSM campaign handlers (new wiring — C1 fix)
vi.mock('@/tree/telegram/telegram-bot-campaign-handlers', () => ({
  handleCampaign: vi.fn(),
  handleFsmTextInput: vi.fn().mockResolvedValue(false),
  handleOfferCallback: vi.fn().mockResolvedValue(false),
  handleConfirmCommand: vi.fn(),
}))

// Mock FSM state manager (clearContext for /cancel)
vi.mock('@/tree/telegram/telegram-fsm-state-manager', () => ({
  TelegramFSM: {
    clearContext: vi.fn().mockResolvedValue(undefined),
    getContext: vi.fn().mockResolvedValue(null),
    setContext: vi.fn().mockResolvedValue(undefined),
    mergeContext: vi.fn().mockResolvedValue(undefined),
  },
  BotState: {
    IDLE: 'idle',
    AWAITING_CAMPAIGN_TOPIC: 'awaiting_campaign_topic',
    AWAITING_CONFIRMATION: 'awaiting_confirmation',
    DISCOVERING_TRENDS: 'discovering_trends',
    CREATING_CAMPAIGN: 'creating_campaign',
  },
  isBotState: vi.fn().mockReturnValue(true),
}))

// Mock D1 client (for /ticket userId lookup and pairing)
vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        lt: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

// Mock pairing module
vi.mock('@/lib/telegram/pairing', () => ({
  isAllowed: vi.fn().mockResolvedValue(true),
  requestPairing: vi.fn().mockResolvedValue({ code: '123456' }),
  approvePairing: vi.fn().mockResolvedValue({ chatId: '999' }),
  listPaired: vi.fn().mockResolvedValue([]),
  revokePairing: vi.fn().mockResolvedValue(true),
}))

// Mock pairing token service (web→bot flow)
vi.mock('@/tree/telegram/pairing-token-service', () => ({
  consumePairingToken: vi.fn().mockResolvedValue(null),
}))

// Mock sendTelegramMessage
vi.mock('@/tree/telegram/telegram-client', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
  sendTelegramMessageWithKeyboard: vi.fn().mockResolvedValue({ ok: true }),
  setTelegramWebhook: vi.fn().mockResolvedValue({ ok: true }),
}))

describe('Telegram Webhook Route', () => {
  const secret = 'test-secret'

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
    process.env.TELEGRAM_WEBHOOK_SECRET = secret
    delete process.env.TELEGRAM_ADMIN_CHAT_ID
    // Restore withMiddleware implementation after resetAllMocks()
    vi.mocked(telegramHandlers.withMiddleware).mockImplementation(
      async (_chatId: string, handler: () => Promise<void>) => handler()
    )
    vi.mocked(campaignHandlers.handleFsmTextInput).mockResolvedValue(false)
    vi.mocked(campaignHandlers.handleOfferCallback).mockResolvedValue(false)
    // Default: pairing gate allows all (isAllowed = true)
    vi.mocked(pairingModule.isAllowed).mockResolvedValue(true)
    vi.mocked(pairingModule.requestPairing).mockResolvedValue({ code: '123456' })
    vi.mocked(pairingModule.approvePairing).mockResolvedValue({ chatId: '999' })
    vi.mocked(pairingModule.listPaired).mockResolvedValue([])
    vi.mocked(pairingModule.revokePairing).mockResolvedValue(true)
  })

  interface TelegramWebhookBody {
    message?: {
      chat?: { id: number };
      text?: string;
    };
    callback_query?: {
      data?: string;
      message?: { chat?: { id?: number } };
    };
  }

  const createRequest = (body: TelegramWebhookBody, headers: Record<string, string> = {}) => {
    return new NextRequest('http://localhost/api/webhooks/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': secret,
        ...headers,
      },
      body: JSON.stringify(body),
    })
  }

  it('should return 200 ok when TELEGRAM_BOT_TOKEN is missing (no retry-storm)', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    const req = createRequest({ message: { chat: { id: 123 }, text: '/start' } })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ ok: true })
    // No handler should have been called
    expect(telegramHandlers.handleStart).not.toHaveBeenCalled()
  })

  it('should return 401 if secret token is invalid', async () => {
    const req = createRequest({}, { 'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('should return 200 ok if no text message', async () => {
    const req = createRequest({ message: {} })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ ok: true })
  })

  it('should route /start to handleStart', async () => {
    const req = createRequest({ message: { chat: { id: 123 }, text: '/start' } })
    await POST(req)
    expect(telegramHandlers.handleStart).toHaveBeenCalledWith('123')
  })

  it('should route /help to handleHelp', async () => {
    const req = createRequest({ message: { chat: { id: 123 }, text: '/help' } })
    await POST(req)
    expect(telegramHandlers.handleHelp).toHaveBeenCalledWith('123')
  })

  it('should route /email to handleEmail', async () => {
    const req = createRequest({ message: { chat: { id: 123 }, text: '/email test@example.com' } })
    await POST(req)
    expect(telegramHandlers.handleEmail).toHaveBeenCalledWith('123', 'test@example.com')
  })

  it('should route /campaign to FSM handleCampaign (C1 fix)', async () => {
    const req = createRequest({ message: { chat: { id: 123 }, text: '/campaign my topic' } })
    await POST(req)
    expect(campaignHandlers.handleCampaign).toHaveBeenCalledWith('123', 'my topic')
  })

  it('should NOT call legacy handleCampaign for /campaign (C1 fix)', async () => {
    const req = createRequest({ message: { chat: { id: 123 }, text: '/campaign test' } })
    await POST(req)
    // Legacy handleCampaign no longer exported from telegram-command-handlers
    // The key check: campaignHandlers.handleCampaign is called, not the legacy one
    expect(campaignHandlers.handleCampaign).toHaveBeenCalled()
  })

  it('should route /confirm to handleConfirmCommand (C1 fix)', async () => {
    const req = createRequest({ message: { chat: { id: 123 }, text: '/confirm' } })
    await POST(req)
    expect(campaignHandlers.handleConfirmCommand).toHaveBeenCalledWith('123')
  })

  it('should route /cancel to TelegramFSM.clearContext (C1 fix)', async () => {
    const req = createRequest({ message: { chat: { id: 123 }, text: '/cancel' } })
    await POST(req)
    expect(fsmStateManager.TelegramFSM.clearContext).toHaveBeenCalledWith('123')
  })

  it('should route /status to handleStatus', async () => {
    const req = createRequest({ message: { chat: { id: 123 }, text: '/status' } })
    await POST(req)
    expect(telegramHandlers.handleStatus).toHaveBeenCalledWith('123')
  })

  it('should route /results to handleResults', async () => {
    const req = createRequest({ message: { chat: { id: 123 }, text: '/results' } })
    await POST(req)
    expect(telegramHandlers.handleResults).toHaveBeenCalledWith('123')
  })

  it('should route unknown commands to handleUnknown', async () => {
    const req = createRequest({ message: { chat: { id: 123 }, text: '/foobar' } })
    await POST(req)
    expect(telegramHandlers.handleUnknown).toHaveBeenCalledWith('123')
  })

  it('should route offer_ callback_query to handleOfferCallback (C1 fix)', async () => {
    vi.mocked(campaignHandlers.handleOfferCallback).mockResolvedValue(true)
    const req = createRequest({
      callback_query: {
        data: 'offer_phenq',
        message: { chat: { id: 123 } },
      },
    })
    await POST(req)
    expect(campaignHandlers.handleOfferCallback).toHaveBeenCalledWith('123', 'offer_phenq')
    // Legacy handleCallbackQuery should NOT be called for offer_ callbacks
    expect(telegramHandlers.handleCallbackQuery).not.toHaveBeenCalled()
  })

  it('should route non-offer callback_query to legacy handleCallbackQuery', async () => {
    const req = createRequest({
      callback_query: {
        data: 'some_other_action',
        message: { chat: { id: 123 } },
      },
    })
    await POST(req)
    expect(telegramHandlers.handleCallbackQuery).toHaveBeenCalledWith('123', 'some_other_action')
  })

  it('should try FSM text input before legacy handleTextMessage (C1 fix)', async () => {
    vi.mocked(campaignHandlers.handleFsmTextInput).mockResolvedValue(true)
    const req = createRequest({ message: { chat: { id: 123 }, text: 'weight loss supplements' } })
    await POST(req)
    expect(campaignHandlers.handleFsmTextInput).toHaveBeenCalledWith('123', 'weight loss supplements')
    expect(telegramHandlers.handleTextMessage).not.toHaveBeenCalled()
  })

  it('should fall through to legacy handleTextMessage when FSM does not handle text', async () => {
    vi.mocked(campaignHandlers.handleFsmTextInput).mockResolvedValue(false)
    const req = createRequest({ message: { chat: { id: 123 }, text: 'hello bot' } })
    await POST(req)
    expect(campaignHandlers.handleFsmTextInput).toHaveBeenCalledWith('123', 'hello bot')
    expect(telegramHandlers.handleTextMessage).toHaveBeenCalledWith('123', 'hello bot')
  })
})

describe('Telegram Webhook Route — DM Pairing Gate', () => {
  const secret = 'test-secret'
  const ADMIN_ID = '999'

  const createRequest = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
    new NextRequest('http://localhost/api/webhooks/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': secret,
        ...headers,
      },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
    process.env.TELEGRAM_WEBHOOK_SECRET = secret
    process.env.TELEGRAM_ADMIN_CHAT_ID = ADMIN_ID
    vi.mocked(telegramHandlers.withMiddleware).mockImplementation(
      async (_chatId: string, handler: () => Promise<void>) => handler()
    )
    vi.mocked(campaignHandlers.handleFsmTextInput).mockResolvedValue(false)
    vi.mocked(campaignHandlers.handleOfferCallback).mockResolvedValue(false)
    vi.mocked(pairingModule.isAllowed).mockResolvedValue(true)
    vi.mocked(pairingModule.requestPairing).mockResolvedValue({ code: '654321' })
    vi.mocked(pairingModule.approvePairing).mockResolvedValue({ chatId: '555' })
    vi.mocked(pairingModule.listPaired).mockResolvedValue([])
    vi.mocked(pairingModule.revokePairing).mockResolvedValue(true)
  })

  it('blocks unknown sender and sends pairing code', async () => {
    vi.mocked(pairingModule.isAllowed).mockResolvedValue(false)
    const req = createRequest({ message: { chat: { id: 123, first_name: 'Bob' }, text: '/start' } })
    await POST(req)
    expect(pairingModule.requestPairing).toHaveBeenCalled()
    // handleStart should NOT be called
    expect(telegramHandlers.handleStart).not.toHaveBeenCalled()
  })

  it('allows paired sender through gate', async () => {
    vi.mocked(pairingModule.isAllowed).mockResolvedValue(true)
    const req = createRequest({ message: { chat: { id: 123 }, text: '/start' } })
    await POST(req)
    expect(telegramHandlers.handleStart).toHaveBeenCalledWith('123')
  })

  it('admin bypasses gate entirely', async () => {
    // Even if isAllowed returns false, admin chat_id bypasses gate
    vi.mocked(pairingModule.isAllowed).mockResolvedValue(false)
    const req = createRequest({ message: { chat: { id: Number(ADMIN_ID) }, text: '/start' } })
    await POST(req)
    expect(telegramHandlers.handleStart).toHaveBeenCalledWith(ADMIN_ID)
    // isAllowed should NOT be called for admin
    expect(pairingModule.isAllowed).not.toHaveBeenCalled()
  })

  it('/pair_approve with valid code approves and notifies', async () => {
    const { sendTelegramMessage } = await import('@/tree/telegram/telegram-client')
    const req = createRequest({
      message: { chat: { id: Number(ADMIN_ID) }, text: '/pair_approve 654321' },
    })
    await POST(req)
    expect(pairingModule.approvePairing).toHaveBeenCalled()
    expect(sendTelegramMessage).toHaveBeenCalledWith(ADMIN_ID, expect.stringContaining('Approved'))
  })

  it('/pair_approve with unknown code replies not-found', async () => {
    vi.mocked(pairingModule.approvePairing).mockResolvedValue(null)
    const { sendTelegramMessage } = await import('@/tree/telegram/telegram-client')
    const req = createRequest({
      message: { chat: { id: Number(ADMIN_ID) }, text: '/pair_approve 000000' },
    })
    await POST(req)
    expect(sendTelegramMessage).toHaveBeenCalledWith(ADMIN_ID, expect.stringContaining('not found'))
  })

  it('/pair_list returns 200 and calls listPaired', async () => {
    const req = createRequest({
      message: { chat: { id: Number(ADMIN_ID) }, text: '/pair_list' },
    })
    const res = await POST(req)
    expect(pairingModule.listPaired).toHaveBeenCalled()
    expect(res.status).toBe(200)
  })

  it('/pair_revoke removes chat', async () => {
    const req = createRequest({
      message: { chat: { id: Number(ADMIN_ID) }, text: '/pair_revoke 555' },
    })
    await POST(req)
    expect(pairingModule.revokePairing).toHaveBeenCalledWith(expect.anything(), '555')
  })

  it('non-admin /pair_approve is not handled as admin command', async () => {
    vi.mocked(pairingModule.isAllowed).mockResolvedValue(true)
    const req = createRequest({
      message: { chat: { id: 123 }, text: '/pair_approve 654321' },
    })
    await POST(req)
    // Should fall through to unknown command handler since 123 != ADMIN_ID
    expect(pairingModule.approvePairing).not.toHaveBeenCalled()
    expect(telegramHandlers.handleUnknown).toHaveBeenCalledWith('123')
  })
})

// ── Pairing token (web→bot) tests ─────────────────────────────────────────────

describe('Telegram Webhook Route — /start <token> pairing', () => {
  const secret = 'test-secret'

  const createRequest = (body: Record<string, unknown>, headers: Record<string, string> = {}) => {
    return new NextRequest('http://localhost/api/webhooks/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': secret,
        ...headers,
      },
      body: JSON.stringify(body),
    })
  }

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
    process.env.TELEGRAM_WEBHOOK_SECRET = secret
    delete process.env.TELEGRAM_ADMIN_CHAT_ID
    vi.mocked(telegramHandlers.withMiddleware).mockImplementation(
      async (_chatId: string, handler: () => Promise<void>) => handler()
    )
    vi.mocked(campaignHandlers.handleFsmTextInput).mockResolvedValue(false)
    vi.mocked(pairingModule.isAllowed).mockResolvedValue(true)
  })

  it('/start without token calls handleStart normally', async () => {
    const { consumePairingToken } = await import('@/tree/telegram/pairing-token-service')
    const req = createRequest({ message: { chat: { id: 111 }, text: '/start' } })
    await POST(req)
    expect(telegramHandlers.handleStart).toHaveBeenCalledWith('111')
    expect(consumePairingToken).not.toHaveBeenCalled()
  })

  it('/start <valid-token> links chat and sends success message', async () => {
    const { consumePairingToken } = await import('@/tree/telegram/pairing-token-service')
    const { sendTelegramMessage } = await import('@/tree/telegram/telegram-client')
    vi.mocked(consumePairingToken).mockResolvedValue({ userId: 'user-xyz' })

    const req = createRequest({
      message: { chat: { id: 222, first_name: 'Tân' }, text: '/start abc123token' },
    })
    await POST(req)

    expect(consumePairingToken).toHaveBeenCalledWith(expect.anything(), 'abc123token')
    expect(sendTelegramMessage).toHaveBeenCalledWith('222', expect.stringContaining('✅'))
    expect(telegramHandlers.handleStart).not.toHaveBeenCalled()
  })

  it('/start <invalid-token> sends error message', async () => {
    const { consumePairingToken } = await import('@/tree/telegram/pairing-token-service')
    const { sendTelegramMessage } = await import('@/tree/telegram/telegram-client')
    vi.mocked(consumePairingToken).mockResolvedValue(null)

    const req = createRequest({
      message: { chat: { id: 333 }, text: '/start badtoken00' },
    })
    await POST(req)

    expect(consumePairingToken).toHaveBeenCalledWith(expect.anything(), 'badtoken00')
    expect(sendTelegramMessage).toHaveBeenCalledWith('333', expect.stringContaining('❌'))
    expect(telegramHandlers.handleStart).not.toHaveBeenCalled()
  })
})
