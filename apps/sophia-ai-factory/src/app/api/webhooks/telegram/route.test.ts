import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'
import * as telegramBot from '@/lib/telegram/telegram-bot'

// Mock the telegram bot handlers
vi.mock('@/lib/telegram/telegram-bot', () => ({
  handleStart: vi.fn(),
  handleHelp: vi.fn(),
  handleEmail: vi.fn(),
  handleCampaign: vi.fn(),
  handleStatus: vi.fn(),
  handleResults: vi.fn(),
  handleUnknown: vi.fn(),
}))

describe('Telegram Webhook Route', () => {
  const secret = 'test-secret'

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.TELEGRAM_WEBHOOK_SECRET = secret
  })

  const createRequest = (body: any, headers: Record<string, string> = {}) => {
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
    const req = createRequest({
      message: {
        chat: { id: 123 },
        text: '/start'
      }
    })
    await POST(req)
    expect(telegramBot.handleStart).toHaveBeenCalledWith('123')
  })

  it('should route /help to handleHelp', async () => {
    const req = createRequest({
      message: {
        chat: { id: 123 },
        text: '/help'
      }
    })
    await POST(req)
    expect(telegramBot.handleHelp).toHaveBeenCalledWith('123')
  })

  it('should route /email to handleEmail', async () => {
    const req = createRequest({
      message: {
        chat: { id: 123 },
        text: '/email test@example.com'
      }
    })
    await POST(req)
    expect(telegramBot.handleEmail).toHaveBeenCalledWith('123', 'test@example.com')
  })

  it('should route /campaign to handleCampaign', async () => {
    const req = createRequest({
      message: {
        chat: { id: 123 },
        text: '/campaign my topic'
      }
    })
    await POST(req)
    expect(telegramBot.handleCampaign).toHaveBeenCalledWith('123', 'my topic')
  })

  it('should route /status to handleStatus', async () => {
    const req = createRequest({
      message: {
        chat: { id: 123 },
        text: '/status'
      }
    })
    await POST(req)
    expect(telegramBot.handleStatus).toHaveBeenCalledWith('123')
  })

  it('should route /results to handleResults', async () => {
    const req = createRequest({
      message: {
        chat: { id: 123 },
        text: '/results'
      }
    })
    await POST(req)
    expect(telegramBot.handleResults).toHaveBeenCalledWith('123')
  })

  it('should route unknown commands to handleUnknown', async () => {
    const req = createRequest({
      message: {
        chat: { id: 123 },
        text: '/foobar'
      }
    })
    await POST(req)
    expect(telegramBot.handleUnknown).toHaveBeenCalledWith('123')
  })
})
