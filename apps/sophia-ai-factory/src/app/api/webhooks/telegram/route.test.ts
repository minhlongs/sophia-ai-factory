/**
 * Telegram Webhook Route Security & Dispatcher Test Suite
 *
 * Verifies X-Telegram-Bot-Api-Secret-Token enforcement before body parsing,
 * dormant bot handling, fail-closed 401/500 responses, and authorized dispatch.
 *
 * @module app/api/webhooks/telegram/route.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const TEST_SECRET = 'telegram_webhook_secret_xyz123'
const TEST_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'

vi.mock('@/tree/telegram/telegram-command-handlers', () => ({
  handleStart: vi.fn().mockResolvedValue(undefined),
  handleHelp: vi.fn().mockResolvedValue(undefined),
  handleEmail: vi.fn().mockResolvedValue(undefined),
  handleStatus: vi.fn().mockResolvedValue(undefined),
  handleResults: vi.fn().mockResolvedValue(undefined),
  handleSubscribe: vi.fn().mockResolvedValue(undefined),
  handleDiscover: vi.fn().mockResolvedValue(undefined),
  handleCallbackQuery: vi.fn().mockResolvedValue(undefined),
  handleCampaignList: vi.fn().mockResolvedValue(undefined),
  handleCampaignCancel: vi.fn().mockResolvedValue(undefined),
  handleAnalytics: vi.fn().mockResolvedValue(undefined),
  withMiddleware: vi.fn((_chatId: string, fn: () => Promise<void>) => fn()),
}))

vi.mock('@/tree/telegram/telegram-bot-campaign-handlers', () => ({
  handleCampaign: vi.fn().mockResolvedValue(undefined),
  handleOfferCallback: vi.fn().mockResolvedValue(undefined),
  handleConfirmCommand: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/tree/telegram/telegram-client', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/tree/telegram/pairing', () => ({
  isAllowed: vi.fn().mockResolvedValue(true),
  requestPairing: vi.fn().mockResolvedValue('123456'),
  approvePairing: vi.fn().mockResolvedValue({ chatId: '987654' }),
  listPaired: vi.fn().mockResolvedValue([]),
  revokePairing: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/tree/telegram/pairing-token-service', () => ({
  consumePairingToken: vi.fn().mockResolvedValue({ valid: true, userId: 'u1' }),
}))

vi.mock('@/seed/db/client', () => ({
  tryCreateServerClient: vi.fn(() => ({
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    })),
  })),
}))

vi.mock('@/seed/r2/bucket-ops', () => ({
  writeDeadLetterToR2: vi.fn().mockResolvedValue(undefined),
  generateDeadLetterKey: vi.fn(() => 'dead-letter-key'),
}))

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

function createTelegramRequest(
  body: Record<string, unknown> | null,
  secretTokenHeader?: string | null,
): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secretTokenHeader !== undefined && secretTokenHeader !== null) {
    headers['x-telegram-bot-api-secret-token'] = secretTokenHeader
  }
  return new NextRequest('http://localhost/api/webhooks/telegram', {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('Telegram Webhook Route Security (POST /api/webhooks/telegram)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TEST_BOT_TOKEN)
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', TEST_SECRET)
  })

  it('returns HTTP 200 in dormant mode when TELEGRAM_BOT_TOKEN is unset', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '')
    const { POST } = await import('./route')
    const res = await POST(createTelegramRequest({ update_id: 1 }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('returns HTTP 500 when TELEGRAM_WEBHOOK_SECRET is missing', async () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', '')
    const { POST } = await import('./route')
    const res = await POST(createTelegramRequest({ update_id: 2 }, TEST_SECRET))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'Webhook secret not configured' })
  })

  it.each([
    ['missing header', null],
    ['forged signature', 'forged_fake_secret_token_123'],
    ['case-mismatched token', TEST_SECRET.toUpperCase()],
  ])('rejects with HTTP 401 on %s', async (_label, token) => {
    const { POST } = await import('./route')
    const res = await POST(createTelegramRequest({ update_id: 3 }, token))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('verifies X-Telegram-Bot-Api-Secret-Token BEFORE reading or parsing request JSON body', async () => {
    const { POST } = await import('./route')
    const req = createTelegramRequest({ update_id: 6 }, 'forged_secret_token')
    const jsonSpy = vi.spyOn(req, 'json')

    const res = await POST(req)

    expect(res.status).toBe(401)
    expect(jsonSpy).not.toHaveBeenCalled()
  })

  it('checks TELEGRAM_WEBHOOK_SECRET configuration BEFORE reading request JSON body', async () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', '')
    const { POST } = await import('./route')
    const req = createTelegramRequest({ update_id: 7 }, TEST_SECRET)
    const jsonSpy = vi.spyOn(req, 'json')

    const res = await POST(req)

    expect(res.status).toBe(500)
    expect(jsonSpy).not.toHaveBeenCalled()
  })

  it('accepts and returns HTTP 200 when authentic secret token is provided with empty update', async () => {
    const { POST } = await import('./route')
    const res = await POST(createTelegramRequest({}, TEST_SECRET))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('accepts and routes callback_query with authentic secret token', async () => {
    const { POST } = await import('./route')
    const req = createTelegramRequest(
      { callback_query: { data: 'help_info', message: { chat: { id: 12345678 } } } },
      TEST_SECRET,
    )
    const res = await POST(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('accepts and processes text message with authentic secret token', async () => {
    const { POST } = await import('./route')
    const req = createTelegramRequest(
      { message: { text: '/help', chat: { id: 12345678, first_name: 'SophiaTester' } } },
      TEST_SECRET,
    )
    const res = await POST(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('gracefully returns HTTP 200 without throwing 500 on JSON literal null or non-string message.text', async () => {
    const { POST } = await import('./route')

    const nullReq = new NextRequest('http://localhost/api/webhooks/telegram', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': TEST_SECRET,
      },
      body: 'null',
    })
    const nullRes = await POST(nullReq)
    expect(nullRes.status).toBe(200)
    await expect(nullRes.json()).resolves.toEqual({ ok: true })

    const nonStringTextReq = createTelegramRequest(
      { message: { text: 12345, chat: { id: 12345678, first_name: 'SophiaTester' } } },
      TEST_SECRET,
    )
    const nonStringTextRes = await POST(nonStringTextReq)
    expect(nonStringTextRes.status).toBe(200)
    await expect(nonStringTextRes.json()).resolves.toEqual({ ok: true })

    const nonPrimitiveChatReq = createTelegramRequest(
      { message: { text: '/help', chat: { id: { toString: null } } } },
      TEST_SECRET,
    )
    const nonPrimitiveChatRes = await POST(nonPrimitiveChatReq)
    expect(nonPrimitiveChatRes.status).toBe(200)
    await expect(nonPrimitiveChatRes.json()).resolves.toEqual({ ok: true })
  })
})
