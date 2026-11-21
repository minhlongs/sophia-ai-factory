/** Optional platform-only alerts. Customer Telegram credentials are never used. */
import { z } from 'zod';
import { registerOpsTelemetrySecret } from './telegram-telemetry-filter';
import { getState, recordFailure, recordSuccess, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { CircuitState, FailureKind, classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

const SERVICE = 'telegram-ops';
export const OPS_ALERT_DEADLINE_MS = 5_000;
const events = ['synthetic_fulfillment_stale', 'mission_auth_failure', 'mission_rate_limit',
  'mission_failed', 'uptime_incident', 'uptime_recovered', 'error_digest'] as const;
export interface OpsAlert {
  severity: 'high' | 'medium' | 'low';
  eventType: typeof events[number];
  incidentId?: string;
}
export type OpsAlertResult = { sent: true } | {
  sent: false;
  reason: 'disabled' | 'unconfigured' | 'invalid_alert' | 'circuit_open' | 'http_error' |
    'rejected' | 'malformed_response' | 'timeout' | 'network_error' | 'rate_limited';
  retryAfterSeconds?: number;
};
interface OpsEnv {
  OPS_ALERT_PROVIDER?: string;
  TELEGRAM_OPS_BOT_TOKEN?: string;
  TELEGRAM_OPS_CHAT_ID?: string;
}
const responseSchema = z.object({
  ok: z.boolean(),
  error_code: z.number().int().optional(),
  parameters: z.object({ retry_after: z.number().int().positive().safe().optional() }).optional(),
  result: z.object({
    message_id: z.number().int().positive(),
    chat: z.object({ id: z.number().int().safe() }),
  }).optional(),
});

async function resolveEnv(): Promise<OpsEnv> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const context = await getCloudflareContext({ async: true });
    // An existing Worker binding set is authoritative, including disabled/missing config.
    if (context?.env) return context.env as unknown as OpsEnv;
  } catch {
    // Local Node/Vitest has no Worker bindings. Never log the exception or secrets.
  }
  return process.env as OpsEnv;
}

/** Only fixed labels and opaque UUIDs/hex incident references can leave the server. */
export function formatOpsAlert(alert: OpsAlert): string {
  const incident = typeof alert.incidentId === 'string' &&
    /^(?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(alert.incidentId)
    ? alert.incidentId.slice(0, 36) : crypto.randomUUID();
  const environment = ['production', 'development', 'test'].includes(process.env.NODE_ENV ?? '')
    ? process.env.NODE_ENV : 'unknown';
  return [
    'Sophia ops / Cảnh báo vận hành',
    `Severity / Mức độ: ${alert.severity}`,
    `Environment / Môi trường: ${environment}`,
    `Event / Sự kiện: ${alert.eventType}`,
    `Incident / Mã sự cố: ${incident}`,
    'Dashboard / Bảng điều khiển (đăng nhập / sign in):',
    'https://sophia.agencyos.network/vi/dashboard/admin',
  ].join('\n').slice(0, 1000);
}

/** Preserve active provider cooldowns across every concurrent failure classification. */
function recordOpsFailure(kind: FailureKind, minCooldownUntil?: number): void {
  const prior = getState(SERVICE);
  const priorCooldownUntil = prior.cooldownUntil ?? 0;
  const preserveCooldown = minCooldownUntil !== undefined ||
    (prior.state === CircuitState.OPEN && priorCooldownUntil > Date.now());
  const entry = recordFailure(SERVICE, kind);
  if (preserveCooldown) {
    entry.state = CircuitState.OPEN;
    entry.cooldownUntil = Math.max(priorCooldownUntil, entry.cooldownUntil ?? 0, minCooldownUntil ?? 0);
  }
}

/** One bounded attempt, no queue or automatic replay. Never throws or returns provider text. */
export async function sendOpsAlert(alert: OpsAlert): Promise<OpsAlertResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadlineExpired = false;
  try {
    const env = await resolveEnv();
    if (env.OPS_ALERT_PROVIDER !== 'telegram') return { sent: false, reason: 'disabled' };
    const token = env.TELEGRAM_OPS_BOT_TOKEN?.trim();
    const chatId = env.TELEGRAM_OPS_CHAT_ID?.trim();
    if (!token || !/^[\w:-]+$/.test(token) || !chatId || !/^-?\d+$/.test(chatId)) {
      return { sent: false, reason: 'unconfigured' };
    }
    registerOpsTelemetrySecret(token);
    if (!alert || !['high', 'medium', 'low'].includes(alert.severity) ||
      !events.includes(alert.eventType)) return { sent: false, reason: 'invalid_alert' };
    if (!shouldAllowRequest(SERVICE)) return { sent: false, reason: 'circuit_open' };
    const controller = new AbortController();
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        deadlineExpired = true;
        controller.abort();
        reject(new DOMException('Ops alert deadline', 'TimeoutError'));
      }, OPS_ALERT_DEADLINE_MS);
    });
    const attempt = async (): Promise<OpsAlertResult> => {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: formatOpsAlert(alert),
          link_preview_options: { is_disabled: true } }),
        signal: controller.signal,
      });
      let json: unknown;
      try { json = await response.json(); } catch { json = null; }
      if (deadlineExpired) return { sent: false, reason: 'timeout' };
      const parsed = responseSchema.safeParse(json);
      const data = parsed.success ? parsed.data : undefined;
      const rateLimit = z.object({ error_code: z.number().optional(),
        parameters: z.object({ retry_after: z.number().int().positive().safe() }).optional(),
      }).safeParse(json);
      if (response.status === 429 || data?.error_code === 429 ||
        (rateLimit.success && rateLimit.data.error_code === 429)) {
        const retryAfterSeconds = rateLimit.success ? rateLimit.data.parameters?.retry_after ?? 60 : 60;
        recordOpsFailure(FailureKind.RATE_LIMIT, Date.now() + retryAfterSeconds * 1000);
        return { sent: false, reason: 'rate_limited', retryAfterSeconds };
      }
      if (!response.ok) {
        recordOpsFailure(classifyHttpStatus(response.status));
        return { sent: false, reason: 'http_error' };
      }
      if (!data || (data.ok && (!data.result || String(data.result.chat.id) !== chatId))) {
        recordOpsFailure(FailureKind.UNKNOWN);
        return { sent: false, reason: 'malformed_response' };
      }
      if (!data.ok) {
        recordOpsFailure(classifyHttpStatus(data.error_code ?? 0));
        return { sent: false, reason: 'rejected' };
      }
      // A concurrent success must not clear a newer rate-limit cooldown.
      const state = getState(SERVICE);
      if (state.state !== CircuitState.OPEN || !state.cooldownUntil || state.cooldownUntil <= Date.now()) {
        recordSuccess(SERVICE);
      }
      return { sent: true };
    };
    return await Promise.race([attempt(), deadline]);
  } catch (error) {
    const timeout = error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name);
    recordOpsFailure(timeout ? FailureKind.TIMEOUT : classifyError(error));
    return { sent: false, reason: timeout ? 'timeout' : 'network_error' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
