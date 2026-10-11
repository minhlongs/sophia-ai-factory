import type { DlqAlertPayload } from '@/seed/types/video-render-queue';

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
