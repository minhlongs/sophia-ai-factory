'use server';

/**
 * Server Action: generateTelegramPairingToken
 *
 * Generates a single-use 32-char hex token stored in telegram_pairing_tokens.
 * Called from the welcome page "Connect Telegram" CTA.
 *
 * Security: userId sourced from auth session — never trusts client input.
 * Token TTL: 1 hour. Single-use (consumed by bot /start handler).
 *
 * @module app/actions/generate-telegram-pairing-token
 */

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { generatePairingToken } from '@/tree/telegram/pairing-token-service';

const inputSchema = z.object({}).strict();

export interface GenerateTelegramPairingTokenResult {
  token: string;
}

export async function generateTelegramPairingTokenAction(
  _input: z.infer<typeof inputSchema> = {},
): Promise<GenerateTelegramPairingTokenResult> {
  // Zod validation (future-proof, currently no fields)
  inputSchema.parse(_input);

  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const db = createServerClient();
  const token = await generatePairingToken(db, user.id);
  return { token };
}
