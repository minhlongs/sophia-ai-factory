import { NextRequest, NextResponse } from 'next/server'
import {
  handleStart,
  handleHelp,
  handleEmail,
  handleCampaign,
  handleStatus,
  handleResults,
  handleUnknown
} from '@/lib/telegram/telegram-bot'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verify webhook secret
    const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
    if (token !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const message = body.message
    if (!message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id.toString() // Ensure string for DB consistency
    const text = message.text.trim()

    console.log(`Telegram update: ${text} from ${chatId}`)

    // Command Routing
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
    } else {
      await handleUnknown(chatId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Helper to send messages is now in src/lib/telegram/telegram-client.ts and telegram-bot.ts handles logic

