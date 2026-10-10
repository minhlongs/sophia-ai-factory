/**
 * Handover package & sanitized environment configuration generator.
 * @module land/actions/handover/package-generator
 */

import { generateSanitizedEnvProduction } from '@/tree/handover/env-export-generator';

const DEFAULT_EXAMPLE_TEMPLATE = `
# ─── Core Platform ────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://sophia.agencyos.network
BETTER_AUTH_URL=https://sophia.agencyos.network
NEXT_PUBLIC_DISTRIBUTE_ENABLED=1
IS_CONFIGURED=true

# ─── Better Auth & Security ───────────────────────────────────────────────────
BETTER_AUTH_SECRET=

# ─── Payments (NOWPayments USDT) ──────────────────────────────────────────────
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
FEATURE_PAYOS=0

# ─── Email & Notifications ───────────────────────────────────────────────────
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@sophia.agencyos.network
SUPPORT_EMAIL=support@sophia.agencyos.network
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# ─── AI Providers (BYOK Fallback) ─────────────────────────────────────────────
OPENROUTER_API_KEY=
ELEVENLABS_API_KEY=
HEYGEN_API_KEY=
FAL_API_KEY=

# ─── Master Encryption Keys (32-byte base64) ──────────────────────────────────
API_ENCRYPTION_KEY=
BYOK_MASTER_KEY=
CREDENTIALS_MASTER_KEY=

# ─── Cron & Background Tasks ─────────────────────────────────────────────────
CRON_SECRET=

# ─── Observability & OpenTelemetry ────────────────────────────────────────────
HONEYCOMB_DATASET=sophia-prod
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_SERVICE_NAME=sophia-api
OTEL_SAMPLERATE=0.01
METRICS_BEARER_TOKEN=
`.trim();

export interface SanitizedEnvResult {
  sanitizedContent: string;
  missingKeys: string[];
  totalKeys: number;
}

export function buildSanitizedEnvExport(): SanitizedEnvResult {
  const envMap: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    envMap[k] = v;
  }

  const sanitized = generateSanitizedEnvProduction(DEFAULT_EXAMPLE_TEMPLATE, envMap);
  return {
    sanitizedContent: sanitized.sanitizedContent,
    missingKeys: sanitized.missingKeys,
    totalKeys: sanitized.totalKeys,
  };
}
