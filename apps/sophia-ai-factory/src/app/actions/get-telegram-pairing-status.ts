'use server';

/**
 * Server Action: getTelegramPairingStatusAction
 *
 * Answers one question from server state: is this customer's Telegram actually
 * paired? Opening the bot link in a tab proves nothing — the pairing only exists
 * once /start has been consumed and a chat id is recorded for the user.
 *
 * Security: userId comes from the auth session, never from client input.
 *
 * @module app/actions/get-telegram-pairing-status
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getChatIdByUserId } from '@/tree/telegram/user-mappings-service';

export interface GetTelegramPairingStatusResult {
  paired: boolean;
}

export async function getTelegramPairingStatusAction(): Promise<GetTelegramPairingStatusResult> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const chatId = await getChatIdByUserId(user.id);
  return { paired: Boolean(chatId) };
}
