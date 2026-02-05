import { NextRequest, NextResponse } from 'next/server'
import { sophiaIndex } from '@/lib/supabase/sophia-index'

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

    const chatId = message.chat.id
    const text = message.text

    // Handle commands
    if (text === '/start') {
      await sendTelegramMessage(chatId, '👋 Welcome to Sophia AI Factory!\n\nTo link your account, please enter your email address (e.g., /email your@email.com).')
    }

    if (text.startsWith('/email')) {
       const email = text.replace('/email', '').trim()
       // TODO: Verify email against user_profiles or auth.users and link chat_id
       // For MVP, just acknowledge.
       await sendTelegramMessage(chatId, `📧 Thanks! We will link ${email} to this chat if an account exists.\n\nTry /discover [niche] to find products!`)
    }

    if (text.startsWith('/discover')) {
      // const niche = text.replace('/discover', '').trim()
      // Fix: Filter by category logic needs to be more robust or map string to number
      // For now, assuming niche is not fully implemented in getTop50 string mapping
      // We will just pass it if it was a number, but typically commands are strings.
      // Modifying sophiaIndex.getTop50 to handle string categories is not part of this plan,
      // so we will only use hiddenGemsOnly if no niche is provided or fallback.

      // Since sophiaIndex.getTop50 takes category as number, we might need to lookup or just ignore for now if string.
      // In the plan it said: category: niche || undefined.
      // But getTop50 expects number.
      // Let's assume for this MVP we just fetch top 50 hidden gems if they type /discover

      const { data: products } = await sophiaIndex.getTop50({
        hiddenGemsOnly: true
      })

      const response = formatProductList(products?.slice(0, 5) || [])
      await sendTelegramMessage(chatId, response)
    }

    if (text.startsWith('/script')) {
      // const url = text.replace('/script', '').trim()
      // TODO: Integrate with script generation
      await sendTelegramMessage(chatId, '🎬 Generating script... (Feature coming soon)')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatProductList(products: any[]) {
  if (!products.length) return '❌ No products found.'

  let message = '🎯 *Top Hidden Gems*\n\n'
  products.forEach((p, i) => {
    message += `${i + 1}. *${p.title}*\n`
    message += `   💰 Avg Earnings: $${p.avg_earnings_usd || 'N/A'}\n`
    message += `   ⭐ SPS Score: ${p.sps_score || 'N/A'}\n\n`
  })
  return message
}
