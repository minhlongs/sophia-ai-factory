/**
 * Telegram payout and earnings commands
 *
 * Layer: forest — orchestrates between tree (messaging) and D1 (commission ledger).
 *
 * @module forest/telegram/payout-commands
 */

import { createServerClient } from '@/seed/db/client'
import { sendTelegramMessage } from '@/tree/telegram/telegram-client'
import { logger } from '@/seed/utils/logger-utility'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ProfileRow {
  user_id: string
}

async function resolveUserId(chatId: string): Promise<string | null> {
  const db = createServerClient()
  const { data } = await db
    .from('user_profiles')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()
  if (!data) return null
  return (data as unknown as ProfileRow).user_id
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface LedgerRow {
  id: string
  commission_cents: number
  withheld_cents: number
  status: string
  payable_at: number | null
  paid_at: number | null
  created_at: number | null
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handle /payout — show pending payout information from commission ledger.
 */
export async function handlePayout(chatId: string): Promise<void> {
  try {
    const userId = await resolveUserId(chatId)
    if (!userId) {
      await sendTelegramMessage(chatId, '⚠️ Account not linked. Please use /email to setup.')
      return
    }

    const db = createServerClient()

    const { data: ledgerRows } = await db
      .from('commission_ledger')
      .select('id, commission_cents, withheld_cents, status, payable_at, paid_at, created_at')
      .eq('affiliate_id', userId)
      .in('status', ['pending', 'payable', 'paying'])
      .order('created_at', { ascending: false })
      .limit(20)

    const rows = ledgerRows as unknown as LedgerRow[] | null

    if (!rows || rows.length === 0) {
      await sendTelegramMessage(
        chatId,
        '💸 No pending payouts. Keep creating campaigns to earn!',
      )
      return
    }

    let message = '💰 *Pending Payouts:*\n\n'
    let totalPendingCents = 0
    let totalPayableCents = 0

    for (const r of rows) {
      const net = r.commission_cents - r.withheld_cents
      if (r.status === 'pending') totalPendingCents += net
      else if (r.status === 'payable' || r.status === 'paying') totalPayableCents += net

      const statusEmoji = r.status === 'payable' || r.status === 'paying' ? '✅' : '⏳'
      message += `${statusEmoji} \`${r.id.slice(0, 8)}\` — $${(net / 100).toFixed(2)}\n`
      message += `   Status: ${r.status}\n`
    }

    message += `\n📊 *Summary:*\n`
    message += `   💵 Payable: $${(totalPayableCents / 100).toFixed(2)}\n`
    message += `   ⏳ Pending approval: $${(totalPendingCents / 100).toFixed(2)}`

    await sendTelegramMessage(chatId, message)
  } catch (error) {
    logger.error('[payout]', error instanceof Error ? error : new Error(String(error)))
    await sendTelegramMessage(chatId, '❌ Error fetching payout info.')
  }
}

/**
 * Handle /earnings — show total earnings breakdown by status.
 */
export async function handleEarnings(chatId: string): Promise<void> {
  try {
    const userId = await resolveUserId(chatId)
    if (!userId) {
      await sendTelegramMessage(chatId, '⚠️ Account not linked. Please use /email to setup.')
      return
    }

    const db = createServerClient()

    const { data: allRows } = await db
      .from('commission_ledger')
      .select('commission_cents, withheld_cents, status')
      .eq('affiliate_id', userId)

    const rows = allRows as unknown as LedgerRow[] | null

    if (!rows || rows.length === 0) {
      await sendTelegramMessage(
        chatId,
        '📈 No earnings data yet. Start creating campaigns with /campaign.',
      )
      return
    }

    let totalPaidCents = 0
    let totalPendingCents = 0
    let totalPayableCents = 0
    let totalClawedBackCents = 0
    const counts = { paid: 0, payable: 0, pending: 0, clawed_back: 0 }

    for (const r of rows) {
      const net = r.commission_cents - r.withheld_cents
      switch (r.status) {
        case 'paid':
          totalPaidCents += net
          counts.paid++
          break
        case 'payable':
          totalPayableCents += net
          counts.payable++
          break
        case 'pending':
          totalPendingCents += net
          counts.pending++
          break
        case 'clawed_back':
        case 'clawback':
          totalClawedBackCents += net
          counts.clawed_back++
          break
      }
    }

    const totalEarnedCents = totalPaidCents + totalPayableCents + totalPendingCents

    let message = '📈 *Earnings Breakdown*\n\n'
    message += `💰 Total earned: $${(totalEarnedCents / 100).toFixed(2)}\n\n`
    message += `✅ *Paid:* $${(totalPaidCents / 100).toFixed(2)} (${counts.paid} txns)\n`
    message += `💵 *Payable:* $${(totalPayableCents / 100).toFixed(2)} (${counts.payable} txns)\n`
    message += `⏳ *Pending:* $${(totalPendingCents / 100).toFixed(2)} (${counts.pending} txns)\n`
    if (totalClawedBackCents > 0) {
      message += `↩️ *Clawed back:* $${(totalClawedBackCents / 100).toFixed(2)}\n`
    }
    message += `\n📊 Total entries: ${rows.length}\n`
    message += `\n_Tip: Use /payout to see details of pending payouts._`

    await sendTelegramMessage(chatId, message)
  } catch (error) {
    logger.error('[earnings]', error instanceof Error ? error : new Error(String(error)))
    await sendTelegramMessage(chatId, '❌ Error fetching earnings.')
  }
}
