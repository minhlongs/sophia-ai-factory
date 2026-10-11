import { logger } from '@/seed/utils/logger-utility';
import type { DlqAlertPayload } from '@/seed/types/video-render-queue';
import type { AlertDispatcherConfig, DlqAlertDispatchResult } from './types';
import { formatTelegramDlqMessage, formatIncidentWebhookPayload } from './webhook-notifier';

/**
 * Dispatch DLQ alerts to Telegram bot and webhook endpoints, falling back to logger if unconfigured
 */
export async function dispatchDlqAlert(
  payload: DlqAlertPayload,
  config?: AlertDispatcherConfig,
): Promise<DlqAlertDispatchResult> {
  const botToken = config?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = config?.telegramChatId || process.env.TELEGRAM_CHAT_ID;
  const webhookUrl =
    config?.incidentWebhookUrl ||
    process.env.BETTER_STACK_INCIDENT_WEBHOOK_URL ||
    process.env.INCIDENT_WEBHOOK_URL;

  const result: DlqAlertDispatchResult = {
    jobId: payload.jobId,
    telegramSent: false,
    webhookSent: false,
    loggedFallback: false,
    errors: [],
  };

  let dispatchedAny = false;

  // 1. Dispatch Telegram Alert if credentials are configured
  if (botToken && chatId) {
    try {
      const text = formatTelegramDlqMessage(payload);
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (response.ok) {
        result.telegramSent = true;
        dispatchedAny = true;
        logger.info(`[dlq-alert] Telegram notification sent for job ${payload.jobId}`);
      } else {
        const errorText = await response.text();
        result.errors?.push(`Telegram HTTP ${response.status}: ${errorText}`);
        logger.warn(`[dlq-alert] Telegram API error for job ${payload.jobId}`, { status: response.status, errorText });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors?.push(`Telegram exception: ${msg}`);
      logger.warn(`[dlq-alert] Telegram dispatch failed for job ${payload.jobId}`, { error: msg });
    }
  }

  // 2. Dispatch Incident Webhook (Better Stack / custom) if configured
  if (webhookUrl) {
    try {
      const webhookPayload = formatIncidentWebhookPayload(payload);
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Sophia-AI-Factory-DLQ-Dispatcher/1.0',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (response.ok) {
        result.webhookSent = true;
        dispatchedAny = true;
        logger.info(`[dlq-alert] Webhook notification sent for job ${payload.jobId}`);
      } else {
        const errorText = await response.text();
        result.errors?.push(`Webhook HTTP ${response.status}: ${errorText}`);
        logger.warn(`[dlq-alert] Webhook error for job ${payload.jobId}`, { status: response.status, errorText });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors?.push(`Webhook exception: ${msg}`);
      logger.warn(`[dlq-alert] Webhook dispatch failed for job ${payload.jobId}`, { error: msg });
    }
  }

  // 3. Fallback to structured logger if neither channel was configured or dispatched
  if (!dispatchedAny) {
    result.loggedFallback = true;
    logger.error(
      `[dlq-alert] [TERMINAL FAILURE] Job ${payload.jobId} routed to DLQ. Reason: ${payload.dlqReason}. Error: ${payload.errorMessage}`,
      {
        jobId: payload.jobId,
        orgId: payload.orgId,
        tier: payload.tier,
        lane: payload.lane,
        provider: payload.provider,
        retries: `${payload.retryCount}/${payload.maxRetries}`,
        dlqReason: payload.dlqReason,
        errorMessage: payload.errorMessage,
        failedAt: new Date(payload.failedAt * 1000).toISOString(),
      },
    );
  }

  return result;
}
