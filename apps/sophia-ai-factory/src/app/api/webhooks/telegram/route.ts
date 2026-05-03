import { NextRequest, NextResponse } from 'next/server'
import {
  handleStart,
  handleHelp,
  handleEmail,
  handleStatus,
  handleResults,
  handleSubscribe,
  handleDiscover,
  handleTextMessage,
  handleUnknown,
  handleCallbackQuery,
  handleTicket,
  handleMissions,
  withMiddleware,
} from '@/lib/telegram/telegram-command-handlers'
import {
  handleCampaign as handleCampaignFsm,
  handleFsmTextInput,
  handleOfferCallback,
  handleConfirmCommand,
} from '@/lib/telegram/telegram-bot-campaign-handlers'
import { TelegramFSM } from '@/lib/telegram/telegram-fsm-state-manager'
import { createServerClient } from '@/lib/db/client'

interface TelegramUpdate {
  callback_query?: {
    data?: string
    message?: { chat?: { id?: number | string } }
  }
  message?: {
    text?: string
    chat?: { id?: number | string }
  }
}

/**
 * Telegram Webhook Handler
 * Processes incoming updates from Telegram Bot API
 * Supports: text commands, callback queries (inline keyboards)
 */
export async function POST(request: NextRequest) {
  // Degrade gracefully when Telegram bot is not configured
  // Returns 200 to prevent Telegram retry-storm; logs warning for operator awareness
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[telegram-webhook] TELEGRAM_BOT_TOKEN is not set — bot is dormant. Run: wrangler secret put TELEGRAM_BOT_TOKEN')
    return NextResponse.json({ ok: true })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as TelegramUpdate

    // Verify webhook secret token only when secret is configured
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (webhookSecret) {
      const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
      if (token !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Handle callback queries (inline keyboard button clicks)
    if (body.callback_query) {
      const chatId = body.callback_query.message?.chat?.id?.toString()
      const callbackData = body.callback_query.data

      if (chatId && callbackData) {
        // Route offer_* callbacks to FSM before falling through to legacy handler
        if (callbackData.startsWith('offer_')) {
          await handleOfferCallback(chatId, callbackData)
          return NextResponse.json({ ok: true })
        }
        await withMiddleware(chatId, () => handleCallbackQuery(chatId, callbackData))
      }
      return NextResponse.json({ ok: true })
    }

    // Extract message from update
    const message = body.message
    if (!message?.text || !message?.chat?.id) {
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
        await handleCampaignFsm(chatId, topic)
      } else if (text === '/confirm') {
        await handleConfirmCommand(chatId)
      } else if (text === '/cancel') {
        await TelegramFSM.clearContext(chatId)
      } else if (text === '/status') {
        await handleStatus(chatId)
      } else if (text === '/results') {
        await handleResults(chatId)
      } else if (text === '/missions') {
        await handleMissions(chatId)
      } else if (text.startsWith('/ticket')) {
        const ticketText = text.replace('/ticket', '').trim()
        // Resolve userId from chat_id — fall back to empty string if not linked
        let userId = ''
        try {
          const db = createServerClient()
          const { data } = await db
            .from('user_profiles')
            .select('user_id')
            .eq('telegram_chat_id', chatId)
            .single()
          if (data) userId = (data as { user_id: string }).user_id
        } catch {
          // Not linked — ticket still created with empty userId
        }
        await handleTicket(chatId, userId, ticketText)
      } else if (text.startsWith('/')) {
        await handleUnknown(chatId)
      } else {
        // Try FSM text input first; fall through to legacy handler if not in FSM flow
        const handledByFsm = await handleFsmTextInput(chatId, text)
        if (!handledByFsm) {
          await handleTextMessage(chatId, text)
        }
      }
    })

    return NextResponse.json({ ok: true })
  } catch {
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
