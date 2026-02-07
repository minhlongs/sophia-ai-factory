import { NextRequest, NextResponse } from 'next/server'
import {
  handleStart,
  handleHelp,
  handleEmail,
  handleCampaign,
  handleStatus,
  handleResults,
  handleTextMessage,
  handleUnknown,
} from '@/lib/telegram/telegram-command-handlers'

/**
 * Telegram Webhook Handler
 * Processes incoming updates from Telegram Bot API
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

    // Extract message from update
    const message = body.message
    if (!message?.text) {
      // No text message, return OK to acknowledge
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id.toString()
    const text = message.text.trim()

    console.log(`[Telegram] Update from ${chatId}: ${text}`)

    // Route commands
    if (text === '/start') {
      await handleStart(chatId)
    } else if (text === '/help') {
      await handleHelp(chatId)
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
      // Unknown command
      await handleUnknown(chatId)
    } else {
      // Regular text message - handle based on FSM state
      await handleTextMessage(chatId, text)
    }

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
