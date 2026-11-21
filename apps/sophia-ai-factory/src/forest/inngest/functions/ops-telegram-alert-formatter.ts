/**
 * Telegram Ops Alert Bilingual Message Formatter & Event Parser
 *
 * Layer: forest (reusable infrastructure orchestrator helper).
 *
 * @module forest/inngest/functions/ops-telegram-alert-formatter
 */

import type { SystemAlertPayload } from '@/seed/types/events';

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
