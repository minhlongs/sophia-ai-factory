/**
 * Dead-Letter Queue (DLQ) Routing, Exponential Backoff & Incident Alert Dispatcher
 *
 * Layer: tree/queue (Domain services & incident routing)
 *
 * Implements:
 * - Exponential backoff calculation: delayMs = Math.min(baseDelayMs * Math.pow(2, retryCount), maxDelayMs)
 * - DLQ routing: when retryCount >= maxRetries, transition job to status = 'dlq' with dlq_reason
 * - Alert dispatcher: sends notifications to Telegram bot and incident webhooks with logger fallback
 *
 * @module tree/queue/dlq-alert-dispatcher
 */

import type { D1Database } from '@/seed/db/client';
import type {
  DlqAlertPayload,
  VideoRenderJob,
  VideoRenderRow,
} from '@/seed/types/video-render-queue';
import { mapRowToJob } from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Result returned by the alert dispatcher
 */
export interface DlqAlertDispatchResult {
  jobId: string;
  telegramSent: boolean;
  webhookSent: boolean;
  loggedFallback: boolean;
  errors?: string[];
}

/**
 * Dispatcher configuration overrides
 */
export interface AlertDispatcherConfig {
  telegramBotToken?: string;
  telegramChatId?: string;
  incidentWebhookUrl?: string;
}

/**
 * Calculate exponential backoff delay in milliseconds
 * Formula: delayMs = Math.min(baseDelayMs * Math.pow(2, retryCount), maxDelayMs)
 */
export function calculateExponentialBackoff(
  retryCount: number,
  baseDelayMs = 1000,
  maxDelayMs = 60000,
  withJitter = false,
): number {
  const safeRetries = Math.max(0, retryCount);
  const exponential = baseDelayMs * Math.pow(2, safeRetries);
  const capped = Math.min(exponential, maxDelayMs);

  if (!withJitter) {
    return Math.floor(capped);
  }

  // 10% additive random jitter
  const jitter = Math.floor(Math.random() * 0.1 * capped);
  return Math.floor(capped + jitter);
}

/**
 * Determine if a job has exceeded its retry budget and should be routed to DLQ
 */
export function shouldRouteToDlq(retryCount: number, maxRetries = 3): boolean {
  return retryCount >= maxRetries;
}

/**
 * Explicitly route a job into the Dead-Letter Queue (DLQ)
 */
export async function routeJobToDlq(
  db: D1Database,
  jobId: string,
  dlqReason = 'MAX_RETRIES_EXCEEDED',
  errorMessage?: string,
): Promise<VideoRenderJob> {
  const now = Math.floor(Date.now() / 1000);

  const existing = await db
    .prepare(`SELECT * FROM video_render_jobs WHERE id = ?`)
    .bind(jobId)
    .first<VideoRenderRow>();

  if (!existing) {
    throw new Error(`Video render job ${jobId} not found`);
  }

  const finalError = errorMessage || existing.error_message || 'Job exceeded max retries';

  await db
    .prepare(
      `UPDATE video_render_jobs
       SET status = 'dlq',
           dlq_reason = ?,
           error_message = ?,
           leased_by = NULL,
           leased_until = NULL,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(dlqReason, finalError, now, jobId)
    .run();

  const updatedRow: VideoRenderRow = {
    ...existing,
    status: 'dlq',
    dlq_reason: dlqReason,
    error_message: finalError,
    leased_by: null,
    leased_until: null,
    updated_at: now,
  };

  const updatedJob = mapRowToJob(updatedRow);

  logger.warn(`[dlq-router] Job ${jobId} transitioned to status=dlq (reason=${dlqReason})`);
  return updatedJob;
}

/**
 * Format a human-readable and HTML-safe Telegram notification
 */
export function formatTelegramDlqMessage(payload: DlqAlertPayload): string {
  const dateStr = new Date(payload.failedAt * 1000).toISOString();
  const subaccount = payload.subaccountId ? `\n<b>Subaccount:</b> <code>${payload.subaccountId}</code>` : '';
  const provider = payload.provider ? payload.provider.toUpperCase() : 'UNKNOWN';

  return [
    `🚨 <b>[SOPHIA DLQ ALERT] Video Render Job Terminal Failure</b>`,
    ``,
    `<b>Job ID:</b> <code>${payload.jobId}</code>`,
    `<b>Org ID:</b> <code>${payload.orgId}</code>${subaccount}`,
    `<b>Tier:</b> ${payload.tier.toUpperCase()} | <b>Lane:</b> ${payload.lane.toUpperCase()}`,
    `<b>Provider:</b> ${provider}`,
    `<b>Retries:</b> ${payload.retryCount} / ${payload.maxRetries}`,
    `<b>DLQ Reason:</b> <code>${payload.dlqReason}</code>`,
    `<b>Error Message:</b> <code>${payload.errorMessage}</code>`,
    `<b>Failed At:</b> ${dateStr}`,
  ].join('\n');
}

/**
 * Format incident webhook payload for Better Stack / PagerDuty / Generic webhook
 */
export function formatIncidentWebhookPayload(payload: DlqAlertPayload): Record<string, unknown> {
  return {
    event: 'video_render_job.dlq',
    job_id: payload.jobId,
    org_id: payload.orgId,
    subaccount_id: payload.subaccountId || null,
    tier: payload.tier,
    lane: payload.lane,
    provider: payload.provider || null,
    retry_count: payload.retryCount,
    max_retries: payload.maxRetries,
    dlq_reason: payload.dlqReason,
    error_message: payload.errorMessage,
    failed_at: payload.failedAt,
    severity: 'critical',
    source: 'sophia-ai-factory/gpu-scheduler',
    metadata: payload.metadata || {},
  };
}

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
