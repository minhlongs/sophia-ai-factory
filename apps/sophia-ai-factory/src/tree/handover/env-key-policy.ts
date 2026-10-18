/**
 * Environment Variable Key Classification & Secret Redaction Policy
 * Layer: tree/handover
 *
 * @module tree/handover/env-key-policy
 */

/** Set of keys strictly classified as public/non-sensitive */
export const PUBLIC_CONFIG_KEYS = new Set<string>([
  'NEXT_PUBLIC_APP_URL',
  'BETTER_AUTH_URL',
  'NEXT_PUBLIC_DISTRIBUTE_ENABLED',
  'NEXT_PUBLIC_CRISP_WEBSITE_ID',
  'IS_CONFIGURED',
  'FEATURE_PAYOS',
  'QUOTA_FAIL_CLOSED',
  'DISABLE_LLM_CIRCUIT_BREAKER',
  'ENABLE_ORG_QUOTAS',
  'R2_PUBLIC_HOSTNAME',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_RELEASE',
  'RESEND_FROM_EMAIL',
  'SUPPORT_EMAIL',
  'FOUNDER_EMAIL',
  'HONEYCOMB_DATASET',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_SERVICE_NAME',
  'OTEL_SAMPLERATE',
  'INSTAGRAM_REDIRECT_URI',
  'TIKTOK_REDIRECT_URI',
  'YOUTUBE_REDIRECT_URI',
  'ELEVENLABS_VOICE_ID',
  'RUNPOD_ENDPOINT_ID',
]);

/** Set of mandatory production keys that must be defined */
export const MANDATORY_PRODUCTION_KEYS = new Set<string>([
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
  'API_ENCRYPTION_KEY',
  'BYOK_MASTER_KEY',
  'NOWPAYMENTS_API_KEY',
  'NOWPAYMENTS_IPN_SECRET',
  'RESEND_API_KEY',
]);

/**
 * Categorizes whether a given key represents a sensitive secret.
 */
export function isSensitiveKey(key: string): boolean {
  if (PUBLIC_CONFIG_KEYS.has(key)) return false;
  const upper = key.toUpperCase();
  return (
    upper.includes('SECRET') ||
    upper.includes('KEY') ||
    upper.includes('TOKEN') ||
    upper.includes('PASSWORD') ||
    upper.includes('AUTH') ||
    upper.includes('CREDENTIAL') ||
    upper.includes('DSN') ||
    upper.includes('SALT')
  );
}

/**
 * Creates a deterministic masked placeholder for a sensitive secret value.
 */
export function maskSecretValue(key: string, value: string | undefined): string {
  const len = value ? value.length : 0;
  const upper = key.toUpperCase();

  if (len === 0) {
    if (upper.includes('KEY')) return '[REDACTED_KEY:len=0]';
    if (upper.includes('TOKEN')) return '[REDACTED_TOKEN:len=0]';
    return '[REDACTED_SECRET:len=0]';
  }

  if (upper.includes('API_ENCRYPTION') || upper.includes('MASTER_KEY')) {
    return `[REDACTED_KEY:len=${len}]`;
  }
  if (upper.includes('API_KEY')) {
    return `[REDACTED_API_KEY:len=${len}]`;
  }
  if (upper.includes('TOKEN')) {
    return `[REDACTED_TOKEN:len=${len}]`;
  }

  return `[REDACTED_SECRET:len=${len}]`;
}
