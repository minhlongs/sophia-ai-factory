/**
 * Telegram Ops Alert Bilingual Message Formatter & Event Parser
 *
 * Layer: forest (reusable infrastructure orchestrator helper).
 *
 * @module forest/inngest/functions/ops-telegram-alert-formatter
 */

import type { SystemAlertPayload } from '@/seed/types/events';

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
  if (!reason) {
    if (failureKind === 'AUTH_FAILURE') {
      reason = 'API Key Expired or Invalid (AUTH_FAILURE) / Khóa API không hợp lệ hoặc hết hạn';
    } else if (failureKind === 'RATE_LIMIT') {
      reason = 'Provider Rate Limit Exceeded (RATE_LIMIT) / Vượt quá giới hạn tần suất của nhà cung cấp';
    } else {
      reason = `Operational Failure (${failureKind}) / Lỗi vận hành hệ thống`;
    }
  }

  const impact = payload.impact || 'Creative Mission execution paused / Tạm dừng xử lý mission';

  let action = payload.action;
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

function asOptionalString(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

export function extractActionableAlertPayload(
  raw: Record<string, unknown>,
): SystemAlertPayload | null {
  const errorCode = asOptionalString(raw.errorCode);
  const failureKind = asOptionalString(raw.failureKind) || errorCode || 'AUTH_FAILURE';

  const isAuth = failureKind.includes('AUTH') || errorCode === '401' || errorCode === '403';
  const isRate = failureKind.includes('RATE') || errorCode === '429';
  if (!isAuth && !isRate && !raw.provider) {
    return null;
  }

  const provider = asOptionalString(raw.provider) || asOptionalString(raw.agentId) || 'fal-ai';
  const reason = asOptionalString(raw.reason) || asOptionalString(raw.errorMessage);
  let resolvedKind = failureKind;
  if (isAuth) resolvedKind = 'AUTH_FAILURE';
  else if (isRate) resolvedKind = 'RATE_LIMIT';

  return {
    provider,
    failureKind: resolvedKind,
    reason,
    impact: asOptionalString(raw.impact),
    action: asOptionalString(raw.action),
    missionId: asOptionalString(raw.missionId),
    chatId: asOptionalString(raw.chatId),
  };
}
