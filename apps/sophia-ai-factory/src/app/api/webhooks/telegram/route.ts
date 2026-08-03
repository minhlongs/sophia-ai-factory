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
  handleCampaignList,
  handleCampaignCancel,
  handleAnalytics,
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
  handleEmbed,
  handleTranslate,
  handleCloneVoice,
  handleSeoScript,
  handleSchedulePublish,
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
} from '@/tree/telegram/pairing'
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

    // M8 fix: webhook secret mandatory in production; only optional in dev
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
    const isDev = process.env.NODE_ENV === 'development'
    if (isDev && !webhookSecret) {
      // Dev without secret — warn and allow
      const { logger } = await import('@/seed/utils/logger-utility')
      logger.warn('[telegram-webhook] TELEGRAM_WEBHOOK_SECRET not set — accepting all requests (dev only)')
    } else if (!webhookSecret) {
      // Production without secret — reject
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    } else {
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

    // ── Public OpenClaw command whitelist (bypass pairing gate) ──────────────
    // Keep this list read-only/status-only. Promo redemption and any command
    // that can mutate accounts, grants, tiers, or credits must stay behind the
    // pairing gate.
    //
    // NOTE: /start is INTENTIONALLY excluded — bare /start should trigger the
    // pairing gate so admin-controlled bots reject unknown senders. The
    // /start <token> deep-link flow consumes the token AFTER the gate (it
    // expects the chat to be paired via web-side admin invite).
    const PUBLIC_COMMANDS = ['/version', '/help'] as const
    const isPublicCommand = PUBLIC_COMMANDS.some(
      (c) => text === c || text.startsWith(`${c} `),
    )

    // ── Token pairing (runs before DM gate) ─────────────────────────────────────
 // Unpaired users who open /start with a valid web-account token bypass
 // the admin-only allowlist and self-link here.
 const pairingToken: string | null =
   text === '/start' ? null : text.startsWith('/start ') ? text.slice(7).trim() : null

 if (pairingToken) {
   const db = createServerClient()
   const result = await consumePairingToken(db, pairingToken)
   if (result) {
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
   } else {
     await sendTelegramMessage(
       chatId,
       "❌ Mã kết nối không hợp lệ hoặc đã hết hạn. Vui lòng bấm \"Kết nối Telegram\" lại trên trang web.\n\n" +
       "❌ Pairing token is invalid or expired. Please click \"Connect Telegram\" again on the website.",
     )
   }
   return NextResponse.json({ ok: true })
 }

 // ── DM pairing gate ────────────────────────────────────────────────────────
    // Skip gate for admin, public commands, and when TELEGRAM_ADMIN_CHAT_ID is
    // not set (open mode).
    if (adminChatId && chatId !== adminChatId && !isPublicCommand && !pairingToken) {
      const db = createServerClient()
      const allowed = await isAllowed(db, chatId)
      if (!allowed) {
        const { code } = await requestPairing(db, chatId, firstName)
        await sendTelegramMessage(
          chatId,
          `Hi! To use Sophia bot, ask the admin to approve you.\n\nYour pairing code: \`${code}\`\n\n_Code expires in 15 minutes._\n\nMeanwhile you can run: /version, /help.`
        )
        return NextResponse.json({ ok: true })
      }
    }

    // Route commands through middleware (rate limiting)
    await withMiddleware(chatId, async () => {
      if (text === '/start' || text.startsWith('/start ')) {
 // Token flow already handled above (before DM gate).
   // Bare /start or already-paired users: normal welcome.
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
        const arg = text.replace('/campaign', '').trim()
        if (arg === 'list') {
          await handleCampaignList(chatId)
        } else if (arg.startsWith('cancel ')) {
          const id = arg.replace('cancel ', '').trim()
          await handleCampaignCancel(chatId, id)
        } else if (arg === 'cancel') {
          await sendTelegramMessage(chatId, '⚠️ Usage: /campaign cancel <campaign_id>\n\nGet campaign IDs with: /campaign list')
        } else {
          const topic = arg
          await handleCampaignFsm(chatId, topic)
        }
      } else if (text === '/confirm') {
        await handleConfirmCommand(chatId)
      } else if (text === '/cancel') {
        await TelegramFSM.clearContext(chatId)

      } else if (text === '/status' || text.startsWith('/status ')) {
      const arg = text.slice(7).trim()
      const statusId = arg || undefined
    await handleStatus(chatId, statusId)
      } else if (text === '/analytics') {
        await handleAnalytics(chatId)
      } else if (text === '/results') {
        await handleResults(chatId)
 }
 });

 return NextResponse.json({ ok: true });
 } catch (error) {
 const { logger } = await import('@/seed/utils/logger-utility');
 logger.error('[telegram-webhook] Unhandled error', { error: String(error) });
 return NextResponse.json({ error: 'Internal error' }, { status: 500 });
 }
 }
