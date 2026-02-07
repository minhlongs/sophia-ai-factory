import { NextRequest, NextResponse } from 'next/server'
import {
  handleStart,
  handleHelp,
  handleEmail,
  handleCampaign,
  handleStatus,
  handleResults,
  handleSubscribe,
  handleDiscover,
  handleTextMessage,
  handleUnknown,
  handleCallbackQuery,
  withMiddleware,
} from '@/lib/telegram/telegram-command-handlers'

/**
 * Telegram Webhook Handler
 * Processes incoming updates from Telegram Bot API
 * Supports: text commands, callback queries (inline keyboards)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verify webhook secret token
    const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (token !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.error('Unauthorized webhook attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Handle callback queries (inline keyboard button clicks)
    if (body.callback_query) {
      const chatId = body.callback_query.message?.chat?.id?.toString()
      const callbackData = body.callback_query.data

      if (chatId && callbackData) {
        await withMiddleware(chatId, () => handleCallbackQuery(chatId, callbackData))
      }
      return NextResponse.json({ ok: true })
    }

    // Extract message from update
    const message = body.message
    if (!message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id.toString()
    const text = message.text.trim()

    // Route commands through middleware (rate limiting)
    await withMiddleware(chatId, async () => {
      if (text === '/start') {
        await handleStart(chatId)
      } else if (text === '/help') {
        await handleHelp(chatId)
      } else if (text === '/subscribe') {
        await handleSubscribe(chatId)
      } else if (text === '/discover') {
        await handleDiscover(chatId)
      } else if (text.startsWith('/email')) {
        const email = text.replace('/email', '').trim()
        await handleEmail(chatId, email)
      } else if (text.startsWith('/campaign')) {
        const topic = text.replace('/campaign', '').trim()
        await handleCampaign(chatId, topic)
      } else if (text === '/status') {
        await handleStatus(chatId)
      } else if (text === '/results') {
        await handleResults(chatId)
      } else if (text.startsWith('/')) {
        await handleUnknown(chatId)
      } else {
        await handleTextMessage(chatId, text)
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram] Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'telegram-webhook',
    timestamp: new Date().toISOString(),
  })
}
