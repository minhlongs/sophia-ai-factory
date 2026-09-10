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

export interface OpsAlertResult {
  sent: boolean;
  reason?: string;
  provider?: string;
  chatId?: string;
}

/**
 * Format a bilingual operations alert message for non-technical operators.
 */
export function formatOpsAlertMessage(payload: {
  provider: string;
  failureKind?: string;
  reason?: string;
  impact?: string;
  action?: string;
}): string {
  const provider = payload.provider || 'unknown-provider';
  const failureKind = payload.failureKind || 'AUTH_FAILURE';

  let reason = payload.reason;
  let impact = payload.impact;
  let action = payload.action;

  if (!reason) {
    if (failureKind === 'AUTH_FAILURE') {
      reason = 'API Key Expired or Invalid (AUTH_FAILURE) / Khóa API không hợp lệ hoặc hết hạn';
    } else if (failureKind === 'RATE_LIMIT') {
      reason = 'Provider Rate Limit Exceeded (RATE_LIMIT) / Vượt quá giới hạn tần suất của nhà cung cấp';
    } else {
      reason = `Operational Failure (${failureKind}) / Lỗi vận hành hệ thống`;
    }
  }

  if (!impact) {
    impact = 'Creative Mission execution paused / Tạm dừng xử lý mission';
  }

  if (!action) {
    if (failureKind === 'AUTH_FAILURE') {
      action = 'Update API key in Setup Wizard: /vi/setup / Cập nhật khóa tại /vi/setup';
    } else if (failureKind === 'RATE_LIMIT') {
      action = 'Check provider quota & retry / Kiểm tra hạn mức và thử lại';
    } else {
      action = 'Inspect system logs & diagnostics / Kiểm tra báo cáo chẩn đoán tại /vi/operations';
    }
  }

  return [
    '⚠️ Sophia Ops Alert / Cảnh báo vận hành',
    '',
    `• Provider / Nhà cung cấp: ${provider}`,
    `• Reason / Lý do: ${reason}`,
    `• Impact / Tác động: ${impact}`,
    `• Action for CEO / Hướng xử lý: ${action}`,
  ].join('\n');
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
    const errorCode = typeof raw.errorCode === 'string' ? raw.errorCode : undefined;
    const failureKind = typeof raw.failureKind === 'string'
      ? raw.failureKind
      : (errorCode || 'AUTH_FAILURE');

    // Only alert on actionable operational or credential failures
    const isAuth = failureKind.includes('AUTH') || errorCode === '401' || errorCode === '403';
    const isRate = failureKind.includes('RATE') || errorCode === '429';
    if (!isAuth && !isRate && !raw.provider) {
      return { sent: false, reason: 'skipped_not_actionable' };
    }

    const provider = typeof raw.provider === 'string'
      ? raw.provider
      : (typeof raw.agentId === 'string' ? raw.agentId : 'fal-ai');

    const reason = typeof raw.reason === 'string'
      ? raw.reason
      : (typeof raw.errorMessage === 'string' ? raw.errorMessage : undefined);

    return processOpsAlert({
      provider,
      failureKind: isAuth ? 'AUTH_FAILURE' : (isRate ? 'RATE_LIMIT' : failureKind),
      reason,
      impact: typeof raw.impact === 'string' ? raw.impact : undefined,
      action: typeof raw.action === 'string' ? raw.action : undefined,
      missionId: typeof raw.missionId === 'string' ? raw.missionId : undefined,
      chatId: typeof raw.chatId === 'string' ? raw.chatId : undefined,
    });
  }
);
