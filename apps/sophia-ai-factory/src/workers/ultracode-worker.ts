import type { D1Client } from '@/seed/db/d1-query-builder'
import { createLogger } from '@/seed/utils/logger-utility'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'

const ULTRACODE_TG_SERVICE = 'ultracode-telegram'

const log = createLogger('workers/ultracode')

/**
 * ultracode-worker — standalone Cloudflare Worker for ultracode runtime.
 *
 * Routes: POST /webhook/telegram  — Telegram bot payload (dual-tree pairing)
 *         GET  /health            — liveness probe
 *         POST /api/v1/agent/:id/chat — Agent chat endpoint (future)
 */

interface TelegramMessage {
  chat: { id: string }
  from: { first_name: string }
  text?: string
}

interface TelegramUpdate {
  message?: TelegramMessage
  callback_query?: { message: TelegramMessage }
}

export interface UltracodeEnv {
  DB: D1Client
  TELEGRAM_BOT_TOKEN: string
  ULTRACODE_JWT_PRIVATE_KEY?: string
  ULTRACODE_JWT_PUBLIC_KEY?: string
  [key: string]: unknown
}

export default {
  async fetch(request: Request, env: UltracodeEnv): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      })
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ status: 'ok', service: 'ultracode', ts: Date.now() })
    }

    if (request.method === 'POST' && url.pathname === '/webhook/telegram') {
      return handleTelegram(request, env)
    }

    return new Response('not found', { status: 404 })
  },
} satisfies ExportedHandler<UltracodeEnv>

// ── handlers ────────────────────────────────────────────────────────────────

import { isAllowed as isTreeAllowed, requestPairing as reqTreePairing } from '../tree/telegram/pairing'
import { isAllowed as isForestAllowed, requestPairing as reqForestPairing } from '../forest/telegram/pairing'

async function handleTelegram(request: Request, env: UltracodeEnv): Promise<Response> {
  try {
    const raw = await request.json()
  const update = raw as TelegramUpdate
  if (!update || typeof update !== 'object') {
    return jsonResponse({ status: 'ignored', reason: 'invalid-payload' })
  }
    const message = update.message || update.callback_query?.message
    if (!message) return jsonResponse({ status: 'ignored', reason: 'no-message' })

    const chatId = String(message.chat.id)
    const firstName = message.from.first_name
    const text = (message.text || '').trim()

    const pairedTree = await isTreeAllowed(env.DB, chatId)
    const pairedForest = await isForestAllowed(env.DB, chatId)

    if (!pairedTree && !pairedForest) {
      const treeCode = await reqTreePairing(env.DB, chatId, firstName)
      await reqForestPairing(env.DB, chatId, firstName)
      await sendTg(env, chatId, `Pairing code: <code>${treeCode.code}</code>\nAsk admin to /pair_approve ${treeCode.code}`)
      return jsonResponse({ status: 'pairing-requested', code: treeCode.code })
    }

    if (text === '/pair') {
      const code = await reqTreePairing(env.DB, chatId, firstName)
      await sendTg(env, chatId, `Pairing code: <code>${code.code}</code>\nAsk admin to /pair_approve ${code.code}`)
      return jsonResponse({ status: 'pairing-requested', code: code.code })
    }

    await sendTg(env, chatId, `Echo: ${text}`)
    return jsonResponse({ status: 'ok' })
  } catch (err) {
    log.error('ultracode worker error', err as Record<string, unknown>)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
    },
  })
}

async function sendTg(env: UltracodeEnv, chatId: string, text: string): Promise<void> {
  if (!shouldAllowRequest(ULTRACODE_TG_SERVICE)) {
    log.warn('ultracode-telegram circuit open, skipping send')
    return
  }
  const token = env.TELEGRAM_BOT_TOKEN as string
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (resp.ok) {
      recordSuccess(ULTRACODE_TG_SERVICE)
    } else {
      recordFailure(ULTRACODE_TG_SERVICE, classifyError(new Error(`Telegram API ${resp.status}`)))
    }
  } catch (e) {
    recordFailure(ULTRACODE_TG_SERVICE, classifyError(e))
    log.error('tg send error', e as Record<string, unknown>)
  }
}
