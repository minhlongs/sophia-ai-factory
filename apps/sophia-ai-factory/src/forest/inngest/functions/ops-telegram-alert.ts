/**
 * Telegram Ops Alert Handler — Inngest Function.
 *
 * Consumes agent.mission.failed events and system alerts,
 * formatting and dispatching bilingual operations alerts to the operator via Telegram.
 *
 * Layer: forest (reusable infrastructure orchestrator).
 *
 * @module forest/inngest/functions/ops-telegram-alert
 */

import { inngest } from '@/seed/inngest/client';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { logger } from '@/seed/utils/logger-utility';
import type { SystemAlertPayload } from '@/seed/types/events';
import {
  formatOpsAlertMessage,
  extractActionableAlertPayload,
} from './ops-telegram-alert-formatter';

export { formatOpsAlertMessage } from './ops-telegram-alert-formatter';

export interface OpsAlertResult {
  sent: boolean;
  reason?: string;
  provider?: string;
  chatId?: string;
}

/**
 * Core dispatch logic for operations alerts.
 */
export async function processOpsAlert(payload: SystemAlertPayload): Promise<OpsAlertResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId =
    payload.chatId ||
    process.env.TELEGRAM_ADMIN_CHAT_ID ||
    process.env.TELEGRAM_CHAT_ID ||
    process.env.ADMIN_TELEGRAM_CHAT_ID ||
    process.env.TELEGRAM_FOUNDER_CHAT_ID;

  if (!botToken || !chatId) {
    logger.warn('opsTelegramAlert: Telegram bot token or chat ID not configured, skipping alert', {
      hasToken: Boolean(botToken),
      hasChatId: Boolean(chatId),
      provider: payload.provider,
    });
    return { sent: false, reason: 'unconfigured' };
  }

  const message = formatOpsAlertMessage(payload);
  const result = await sendTelegramMessage(chatId, message);

  if (!result) {
    logger.warn('opsTelegramAlert: sendTelegramMessage returned null or failed', {
      chatId,
      provider: payload.provider,
    });
    return { sent: false, reason: 'delivery_failed', provider: payload.provider };
  }

  logger.info('opsTelegramAlert: successfully dispatched Telegram ops alert', {
    chatId,
    provider: payload.provider,
  });
  return { sent: true, provider: payload.provider, chatId };
}

export const opsTelegramAlert = inngest.createFunction(
  {
    id: 'ops-telegram-alert',
    retries: 1,
  },
  { event: 'agent.mission.failed' },
  async ({ event }) => {
    const raw = event.data as unknown as Record<string, unknown>;
    const payload = extractActionableAlertPayload(raw);
    if (!payload) {
      return { sent: false, reason: 'skipped_not_actionable' };
    }
    return processOpsAlert(payload);
  }
);
