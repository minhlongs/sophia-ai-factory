/**
 * GET /api/admin/handover/export-env
 * Layer: app router route handler
 *
 * Generates a sanitized .env.production bundle for customer handover and offline vault storage.
 * Masks all secrets with length markers while preserving verified public configurations.
 *
 * Query params:
 *   format: "text" | "env" (default, returns file attachment) | "json" (returns JSON summary)
 *
 * Auth: Admin session cookie, X-Deploy-Guard-Token, or Bearer CRON_SECRET/INTERNAL_API_SECRET.
 *
 * @module app/api/admin/handover/export-env/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDeploy } from '@/seed/auth/require-admin';
import { logger } from '@/seed/utils/logger-utility';
import { generateSanitizedEnvProduction } from '@/tree/handover/env-export-generator';

export const dynamic = 'force-dynamic';

const CANONICAL_ENV_TEMPLATE = `
# Phase 10: Multi-Channel Publisher — REQUIRED env vars
OAUTH_TOKEN_ENC_KEY=
OAUTH_STATE_SECRET=
R2_PUBLIC_HOSTNAME=

INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_REDIRECT_URI=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=

INSTAGRAM_WEBHOOK_SECRET=
TIKTOK_WEBHOOK_SECRET=
YOUTUBE_WEBHOOK_SECRET=

# Sentry Observability
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=sophia-ai-factory
SENTRY_PROJECT=sophia-ai-factory
SENTRY_RELEASE=

# ─── Core App ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://sophia.agencyos.network
NEXT_PUBLIC_DISTRIBUTE_ENABLED=1
NEXT_PUBLIC_CRISP_WEBSITE_ID=
COMMIT_SHA=

# ─── Better Auth ─────────────────────────────────────────────────────────────
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://sophia.agencyos.network

# ─── Inngest ─────────────────────────────────────────────────────────────────
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# ─── Payments — NOWPayments ──────────────────────────────────────────────────
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
FEATURE_PAYOS=0

# ─── Telegram Bot ────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_ADMIN_CHAT_ID=

# ─── AI Providers (BYOK fallback) ────────────────────────────────────────────
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
DEEPSEEK_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
HEYGEN_API_KEY=
HEYGEN_WEBHOOK_SECRET=
FAL_API_KEY=
REPLICATE_API_KEY=
RUNPOD_API_KEY=
RUNPOD_ENDPOINT_ID=

# ─── Encryption Keys (32-byte base64 each) ───────────────────────────────────
API_ENCRYPTION_KEY=
API_KEY_SECRET=
BYOK_MASTER_KEY=
CREDENTIALS_MASTER_KEY=
AUDIT_RECEIPT_SECRET=
AUDIT_HASH_SALT=

# ─── Email / Notifications ───────────────────────────────────────────────────
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@sophia.agencyos.network
SUPPORT_EMAIL=support@sophia.agencyos.network
FOUNDER_EMAIL=

# ─── Cron / Background Jobs ──────────────────────────────────────────────────
CRON_SECRET=

# ─── OpenTelemetry Observability (Honeycomb) ─────────────────────────────────
HONEYCOMB_API_KEY=
HONEYCOMB_DATASET=sophia-prod
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_SERVICE_NAME=sophia-api
OTEL_SAMPLERATE=0.01
METRICS_BEARER_TOKEN=
`.trim();

/**
 * Validates request authentication.
 */
async function checkExportAuth(request: NextRequest): Promise<boolean | NextResponse> {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const cronSecret = process.env.CRON_SECRET;
    const internalSecret = process.env.INTERNAL_API_SECRET;
    if ((cronSecret && token === cronSecret) || (internalSecret && token === internalSecret)) {
      return true;
    }
  }

  const auth = await requireAdminOrDeploy(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  return true;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authCheck = await checkExportAuth(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const url = new URL(request.url);
  const format = url.searchParams.get('format') ?? 'env';

  try {
    const envMap: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(process.env)) {
      envMap[k] = v;
    }

    const result = generateSanitizedEnvProduction(CANONICAL_ENV_TEMPLATE, envMap);

    if (format === 'json') {
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    return new NextResponse(result.sanitizedContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename=".env.production"',
        'Cache-Control': 'no-store, max-age=0',
        'X-Missing-Keys': String(result.missingKeys.length),
        'X-Total-Keys': String(result.totalKeys),
      },
    });
  } catch (err) {
    logger.error('[api/admin/handover/export-env] Failed to generate sanitized env export', err instanceof Error ? err : undefined);
    return NextResponse.json(
      {
        error: 'Export generation failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
