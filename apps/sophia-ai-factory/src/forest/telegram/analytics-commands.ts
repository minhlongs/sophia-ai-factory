/**
 * Telegram analytics and snapshot commands
 *
 * Layer: forest — orchestrates between tree (messaging) and D1 (analytics data).
 *
 * @module forest/telegram/analytics-commands
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
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handle /analytics — show total campaigns, videos, and earnings summary.
 */
export async function handleAnalytics(chatId: string): Promise<void> {
  try {
    const userId = await resolveUserId(chatId)
    if (!userId) {
      await sendTelegramMessage(chatId, '⚠️ Account not linked. Please use /email to setup.')
      return
    }

    const db = createServerClient()

    const { data: allCampaigns } = await db
      .from('campaigns')
      .select('id, status')
      .eq('user_id', userId)

    const rows = (allCampaigns ?? []) as Array<{ id: string; status: string | null }>
    const totalCampaigns = rows.length
    const completedCampaigns = rows.filter(
      (r) => r.status === 'completed' || r.status === 'published',
    ).length
    const activeCampaigns = rows.filter(
      (r) =>
        r.status &&
        r.status !== 'completed' &&
        r.status !== 'published' &&
        r.status !== 'failed',
    ).length
    const failedCampaigns = rows.filter((r) => r.status === 'failed').length

    // Count completed campaigns with video_url
    const { data: videosData } = await db
      .from('campaigns')
      .select('video_url')
      .eq('user_id', userId)
      .in('status', ['completed', 'published'])

    const videoRows = (videosData ?? []) as Array<{ video_url: string | null }>
    const totalVideos = videoRows.filter((r) => r.video_url).length

    let message = '📊 *Analytics Summary*\n\n'
    message += `📋 *Campaigns:*\n`
    message += `   Total: ${totalCampaigns}\n`
    message += `   ✅ Completed: ${completedCampaigns}\n`
    message += `   ⏳ Active: ${activeCampaigns}\n`
    message += `   ❌ Failed: ${failedCampaigns}\n`
    message += `\n🎬 *Videos:* ${totalVideos} total`

    await sendTelegramMessage(chatId, message)
  } catch (error) {
    logger.error('[analytics]', error instanceof Error ? error : new Error(String(error)))
    await sendTelegramMessage(chatId, '❌ Error fetching analytics.')
  }
}

/**
 * Handle /snapshot [day|week|month] — show recent campaign activity snapshot.
 */
export async function handleSnapshot(
  chatId: string,
  period: 'day' | 'week' | 'month' = 'week',
): Promise<void> {
  try {
    const userId = await resolveUserId(chatId)
    if (!userId) {
      await sendTelegramMessage(chatId, '⚠️ Account not linked. Please use /email to setup.')
      return
    }

    const now = Date.now()
    const periodMs: Record<string, number> = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    }
    const cutoff = new Date(now - (periodMs[period] ?? periodMs.week)).toISOString()

    const db = createServerClient()

    const { data: recentCampaigns } = await db
      .from('campaigns')
      .select('id, title, status, created_at, updated_at')
      .eq('user_id', userId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(10)

    const rows = (recentCampaigns ?? []) as Array<{
      id: string
      title: string
      status: string | null
      created_at: string
      updated_at: string
    }>

    const periodLabel = period === 'day' ? '24h' : period === 'week' ? '7 days' : '30 days'
    let message = `📸 *Snapshot — Last ${periodLabel}*\n\n`

    if (rows.length === 0) {
      message += 'No campaign activity in this period.\n'
    } else {
      message += `📋 *Campaigns Created:* ${rows.length}\n\n`
      rows.forEach((c) => {
        const statusEmoji =
          c.status === 'completed' ? '✅' :
          c.status === 'failed' ? '❌' :
          c.status?.startsWith('processing') ? '⚙️' : '⏳'
        message += `${statusEmoji} *${c.title}*\n`
        message += `   Status: ${c.status ?? 'unknown'}\n`
        message += `   Created: ${new Date(c.created_at).toLocaleDateString()}\n\n`
      })
    }

    await sendTelegramMessage(chatId, message)
  } catch (error) {
    logger.error('[snapshot]', error instanceof Error ? error : new Error(String(error)))
    await sendTelegramMessage(chatId, '❌ Error fetching snapshot.')
  }
}
