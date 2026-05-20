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
} from '@/tree/telegram/telegram-command-handlers'
import {
  handleVersion,
  handleTier,
  handleQuota,
  handleAffiliate,
  handleVideos,
  handleHandover,
  handleFree100,
} from '@/land/openclaw-telegram/openclaw-handlers'
import {
  handleCampaign as handleCampaignFsm,
  handleFsmTextInput,
  handleOfferCallback,
  handleConfirmCommand,
} from '@/tree/telegram/telegram-bot-campaign-handlers'
import { TelegramFSM } from '@/tree/telegram/telegram-fsm-state-manager'
import { createServerClient } from '@/seed/db/client'
import { sendTelegramMessage } from '@/tree/telegram/telegram-client'
import {
  isAllowed,
  requestPairing,
  approvePairing,
  listPaired,
  revokePairing,
} from '@/lib/telegram/pairing'
import { consumePairingToken } from '@/tree/telegram/pairing-token-service'

interface TelegramUpdate {
  callback_query?: {
    data?: string
    message?: { chat?: { id?: number | string } }
  }
  message?: {
    text?: string
    chat?: { id?: number | string; first_name?: string }
  }
}

/**
 * Telegram Webhook Handler
 * Processes incoming updates from Telegram Bot API
 * Supports: text commands, callback queries (inline keyboards)
 *
 * DM Pairing gate: unknown senders receive a pairing code.
 * Admin approves with /pair_approve <CODE>.
 * See src/lib/telegram/pairing.ts for full flow.
 */
export async function POST(request: NextRequest) {
  // Degrade gracefully when Telegram bot is not configured
  // Returns 200 to prevent Telegram retry-storm; logs warning for operator awareness
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    // Use structured logger so this is sampled by Workers Logs cost controls.
    const { logger } = await import('@/seed/utils/logger-utility')
    logger.warn('[telegram-webhook] TELEGRAM_BOT_TOKEN is not set — bot is dormant')
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
    const firstName = message.chat.first_name ?? ''
    const text = message.text.trim()
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID

    // ── Admin-only pairing commands (processed before allowlist gate) ──────────
    if (adminChatId && chatId === adminChatId) {
      if (text.startsWith('/pair_approve')) {
        const code = text.replace('/pair_approve', '').trim()
        if (!code) {
          await sendTelegramMessage(chatId, 'Usage: /pair\\_approve <CODE>')
          return NextResponse.json({ ok: true })
        }
        const db = createServerClient()
        const result = await approvePairing(db, code, chatId)
        if (!result) {
          await sendTelegramMessage(chatId, 'Code not found or expired.')
          return NextResponse.json({ ok: true })
        }
        await sendTelegramMessage(chatId, `Approved. Chat \`${result.chatId}\` added.`)
        await sendTelegramMessage(result.chatId, 'You have been approved! Send /start to begin.')
        return NextResponse.json({ ok: true })
      }

      if (text === '/pair_list') {
        const db = createServerClient()
        const rows = await listPaired(db)
        if (rows.length === 0) {
          await sendTelegramMessage(chatId, 'No paired chats.')
          return NextResponse.json({ ok: true })
        }
        const lines = rows.map(
          (r) => `• \`${r.chat_id}\` ${r.first_name ?? '—'} (${r.paired_at.slice(0, 10)})`
        )
        await sendTelegramMessage(chatId, `*Paired chats:*\n${lines.join('\n')}`)
        return NextResponse.json({ ok: true })
      }

      if (text.startsWith('/pair_revoke')) {
        const targetId = text.replace('/pair_revoke', '').trim()
        if (!targetId) {
          await sendTelegramMessage(chatId, 'Usage: /pair\\_revoke <CHAT\\_ID>')
          return NextResponse.json({ ok: true })
        }
        const db = createServerClient()
        const removed = await revokePairing(db, targetId)
        await sendTelegramMessage(
          chatId,
          removed ? `Revoked \`${targetId}\`.` : `Chat \`${targetId}\` not found.`
        )
        return NextResponse.json({ ok: true })
      }
    }

    // ── DM pairing gate ────────────────────────────────────────────────────────
    // Skip gate for admin and when TELEGRAM_ADMIN_CHAT_ID is not set (open mode)
    if (adminChatId && chatId !== adminChatId) {
      const db = createServerClient()
      const allowed = await isAllowed(db, chatId)
      if (!allowed) {
        const { code } = await requestPairing(db, chatId, firstName)
        await sendTelegramMessage(
          chatId,
          `Hi! To use Sophia bot, ask the admin to approve you.\n\nYour pairing code: \`${code}\`\n\n_Code expires in 15 minutes._`
        )
        return NextResponse.json({ ok: true })
      }
    }

    // Route commands through middleware (rate limiting)
    await withMiddleware(chatId, async () => {
      if (text === '/start' || text.startsWith('/start ')) {
        const pairingToken = text.startsWith('/start ') ? text.slice(7).trim() : ''
        if (pairingToken) {
          // Attempt web-account pairing via token
          const db = createServerClient()
          const result = await consumePairingToken(db, pairingToken)
          if (!result) {
            // Token invalid or expired
            await sendTelegramMessage(
              chatId,
              '❌ Mã kết nối không hợp lệ hoặc đã hết hạn. Vui lòng bấm "Kết nối Telegram" lại trên trang web.\n\n' +
              '❌ Pairing token is invalid or expired. Please click "Connect Telegram" again on the website.',
            )
            return
          }
          // Link chat_id to userId in telegram_paired_chats
          const db2 = createServerClient()
          await db2.from('telegram_paired_chats').upsert({
            chat_id: chatId,
            first_name: firstName || null,
            paired_at: new Date().toISOString(),
            paired_by: result.userId,
          })
          await sendTelegramMessage(
            chatId,
            `✅ Đã kết nối! Xin chào ${firstName || 'bạn'}. Gõ /campaign để bắt đầu tạo video.\n\n` +
            `✅ Linked! Hi ${firstName || 'there'}. Type /campaign to start creating videos.`,
          )
          return
        }
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
      } else if (text === '/version') {
        await handleVersion(chatId)
      } else if (text === '/tier') {
        await handleTier(chatId)
      } else if (text === '/quota') {
        await handleQuota(chatId)
      } else if (text === '/affiliate') {
        await handleAffiliate(chatId)
      } else if (text === '/videos' || text.startsWith('/videos ')) {
        const filter = text === '/videos' ? undefined : text.replace('/videos', '').trim()
        await handleVideos(chatId, filter || undefined)
      } else if (text === '/handover') {
        await handleHandover(chatId)
      } else if (text.startsWith('/free100')) {
        const email = text.replace('/free100', '').trim()
        await handleFree100(chatId, email)
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
