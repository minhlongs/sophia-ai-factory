/**
 * Telegram Bot Offer Picker
 *
 * Builds inline keyboard and message text for affiliate offer selection.
 * Presents top programs to user as tappable buttons in Telegram.
 *
 * @module telegram/telegram-bot-offer-picker
 */

import { AffiliateProgram } from '@/seed/types';
import { InlineKeyboardMarkup } from './telegram-client';

/**
 * Build an inline keyboard with one button per affiliate program.
 * callback_data format: "offer_{programId}"
 */
export function buildOfferKeyboard(programs: AffiliateProgram[]): InlineKeyboardMarkup {
  return {
    inline_keyboard: programs.map(program => ([
      {
        text: `${program.name} — ${program.commission}`,
        callback_data: `offer_${program.id}`,
      },
    ])),
  };
}

/**
 * Format a list of affiliate programs as a human-readable offer selection message.
 * Example output:
 *   Pick an affiliate offer for your video:
 *   1. PhenQ — €120/sale (EPC: $2.40)
 *   2. LeanBiome — €80/sale (EPC: $1.80)
 */
export function formatOfferList(programs: AffiliateProgram[]): string {
  if (programs.length === 0) {
    return '❌ No affiliate offers available for your tier.';
  }

  const lines = programs.map((p, i) => {
    const epc = p.epc > 0 ? ` | EPC: $${p.epc.toFixed(2)}` : '';
    return `${i + 1}. *${p.name}* — ${p.commission}${epc}`;
  });

  return `🎯 *Pick an affiliate offer for your video:*\n\n${lines.join('\n')}\n\nTap a button below to select:`;
}

/**
 * Extract program ID from callback_data string.
 * Returns null if not a valid offer callback.
 */
export function extractOfferIdFromCallback(callbackData: string): string | null {
  if (!callbackData.startsWith('offer_')) return null;
  const id = callbackData.slice('offer_'.length);
  return id.length > 0 ? id : null;
}
