/**
 * Telegram /missions command handler
 *
 * Lists recent engine_missions for the user linked to this Telegram chat.
 */

import { createServerClient } from '@/seed/db/client';
import { sendMessage } from '@/tree/telegram/handlers/utils';

interface ProfileRow {
  user_id: string;
}

interface MissionRow {
  id: string;
  command: string;
  status: string;
  credits_used: number;
  created_at: number;
}

/**
 * Handle /missions command — shows recent missions + status.
 */
export async function handleMissions(chatId: string): Promise<void> {
  const db = createServerClient();

  // Resolve user from telegram chat_id
  const { data: profile } = await db
    .from('user_profiles')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .single() as { data: ProfileRow | null; error: unknown };

  if (!profile) {
    await sendMessage(
      chatId,
      '❌ Account not linked. Use /email to link your Sophia account first.',
    );
    return;
  }

  const { data: missions } = await db
    .from('engine_missions')
    .select('id, command, status, credits_used, created_at')
    .eq('user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(5) as { data: MissionRow[] | null; error: unknown };

  if (!missions || missions.length === 0) {
    await sendMessage(
      chatId,
      '📭 No missions yet. Run your first mission at https://sophia.agencyos.network/dashboard/missions',
    );
    return;
  }

  const statusEmoji: Record<string, string> = {
    pending: '⏳',
    running: '🔄',
    succeeded: '✅',
    failed: '❌',
    cancelled: '🚫',
  };

  let message = '🚀 *Recent Missions*\n\n';
  for (const m of missions) {
    const emoji = statusEmoji[m.status] ?? '❓';
    const shortId = m.id.slice(0, 8);
    message += `${emoji} \`${m.command}\` — ${m.status} (${m.credits_used} MCU)\n`;
    message += `   ID: ${shortId}...\n\n`;
  }

  message += `View all: https://sophia.agencyos.network/dashboard/missions`;

  await sendMessage(chatId, message);
}
