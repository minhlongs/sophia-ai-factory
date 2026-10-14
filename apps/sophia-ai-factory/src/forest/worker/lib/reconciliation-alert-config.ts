/**
 * Alert emitter configuration and rate limiting.
 *
 * @module worker/reconciliation-alert-config
 */

export interface AlertEmitterConfig {
  alertsEndpoint: string;
  apiKey: string;
  rateLimitWindowMs: number;
  maxAlertsPerWindow: number;
}

export const DEFAULT_ALERT_EMITTER_CONFIG: AlertEmitterConfig = {
  alertsEndpoint: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/alerts` : '/api/alerts',
  apiKey: '',
  rateLimitWindowMs: 60000, // 1 minute
  maxAlertsPerWindow: 10,
};

const rateLimitState = new Map<string, { count: number; windowStart: number }>();

export function isAlertRateLimited(key: string, config: AlertEmitterConfig): boolean {
  const now = Date.now();
  const state = rateLimitState.get(key);

  if (!state || (now - state.windowStart) > config.rateLimitWindowMs) {
    rateLimitState.set(key, { count: 1, windowStart: now });
    return false;
  }

  if (state.count >= config.maxAlertsPerWindow) {
    return true;
  }

  state.count++;
  return false;
}
