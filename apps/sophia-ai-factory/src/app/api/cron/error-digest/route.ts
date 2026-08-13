/**
 * POST/GET /api/cron/error-digest
 * Daily 05:00 UTC — queries error_log, sends fingerprint-only summary to OpenRouter,
 * emails founder + Telegram message.
 * RED-TEAM #2: ONLY fingerprints+counts shipped to OpenRouter — NEVER raw stacks/messages.
 * RED-TEAM #3: CRON_SECRET auth required.
 * RED-TEAM #5: D1 failure → push fatal log to Better Stack, return early.
 * Architecture note: currently triggered via wrangler cron (HTTP GET/POST).
 * Future: migrate to CF Workers scheduled() handler to remove HTTP exposure entirely.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pushFatalLog } from '@/seed/observability/telemetry/better-stack-client';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { getErrorMessage } from '@/seed/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { emit } from '@/land/webhooks/emitter';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'error-digest';
/** Daily — skip if ran within last 12 hours */
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

interface ErrorRow {
  msg_class: string;
  fingerprint: string;
  c: number;
}

interface D1Result {
  results: ErrorRow[];
}

interface D1Binding {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => { all: () => Promise<D1Result> };
  };
}

interface GlobalEnv {
  DB?: D1Binding;
}

function verifyCronSecret(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

async function callOpenRouter(fingerprints: ErrorRow[]): Promise<string> {
  const openRouterKey = await resolveUserApiKey(null, 'openrouter', process.env.OPENROUTER_API_KEY);
  if (!openRouterKey || !fingerprints.length) {
    return 'No errors in the past 24 hours.';
  }

  // RED-TEAM #2: ship ONLY class + fingerprint + count — no raw messages/stacks
  const input = fingerprints.map((r) => ({
    class: r.msg_class,
    fingerprint: r.fingerprint,
    count: r.c,
  }));

  const systemPrompt = 'You are a production reliability assistant. Given error fingerprints and counts (no raw messages), identify the top 3 error classes to investigate. Be concise — 3 bullet points max.';
  const userPrompt = JSON.stringify(input);

  try {
    const content = await (await import('@/seed/inference/openrouter-client')).resilientChatCompletion(
      `System: ${systemPrompt}\n\nUser: ${userPrompt}`,
      {
        openRouterKey,
        anthropicKey: undefined,
        enableFallback: false,
        model: 'openai/gpt-4o-mini',
      }
    );
    return content.trim() || 'No summary available.';
  } catch (err) {
    return `OpenRouter error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function sendTelegram(message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const SERVICE = 'telegram-error-digest';
  if (!shouldAllowRequest(SERVICE)) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    });
    if (res.ok) {
      recordSuccess(SERVICE);
    } else {
      const kind = classifyHttpStatus(res.status);
      recordFailure(SERVICE, kind);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Circuit breaker open')) throw err;
    const kind = classifyError(err);
    recordFailure(SERVICE, kind);
  }
}

async function sendFounderEmail(to: string, subject: string, body: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const SERVICE = 'resend-error-digest';
  if (!shouldAllowRequest(SERVICE)) return;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sophia Monitor <noreply@sophia.agencyos.network>',
        to: [to],
        subject,
        text: body,
      }),
    });
    if (res.ok) {
      recordSuccess(SERVICE);
    } else {
      const kind = classifyHttpStatus(res.status);
      recordFailure(SERVICE, kind);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Circuit breaker open')) throw err;
    const kind = classifyError(err);
    recordFailure(SERVICE, kind);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

async function handler(request: NextRequest): Promise<NextResponse> {
  // RED-TEAM #3: verify CRON_SECRET
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cronCtx = startCronCheckIn(CRON_NAME);
  const bsConfig = {
    logsToken: process.env.BETTER_STACK_LOGS_TOKEN ?? '',
    ingestingHost: process.env.BETTER_STACK_INGESTING_HOST,
  };

  const db = (globalThis as unknown as GlobalEnv).DB;
  if (!db) {
    await pushFatalLog('D1_UNAVAILABLE', 'DB binding missing in error-digest', bsConfig);
    failCronCheckIn(cronCtx, CRON_NAME, new Error('D1_UNAVAILABLE'));
    return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE' }, { status: 200 });
  }

  // Idempotency check — informational, not strict
  if (await wasRecentlyRun(db as unknown as D1Database, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  // RED-TEAM #5: D1 query wrapped in try/catch
  let rows: ErrorRow[] = [];
  try {
    const result = await db
      .prepare(
        `SELECT msg_class, fingerprint, count(*) as c
         FROM error_log
         WHERE ts > datetime('now', '-24 hours')
         GROUP BY fingerprint
         ORDER BY c DESC
         LIMIT 50`
      )
      .bind()
      .all();
    rows = result.results ?? [];
  } catch (d1Err) {
    const errMsg = getErrorMessage(d1Err);
    await pushFatalLog('D1_UNAVAILABLE', errMsg, bsConfig);
    await recordCronRun(db as unknown as D1Database, CRON_NAME, 'failure', errMsg);
    failCronCheckIn(cronCtx, CRON_NAME, d1Err);
    return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE' }, { status: 200 });
  }

  // RED-TEAM #2: only fingerprints+counts to OpenRouter
  const summary = await callOpenRouter(rows);
  const errorCount = rows.reduce((acc, r) => acc + r.c, 0);
  const dateStr = new Date().toISOString().slice(0, 10);

  // Emit error.threshold webhook when total 24h error count exceeds threshold
  const ERROR_THRESHOLD = 10;
  if (errorCount > ERROR_THRESHOLD) {
    const sampleErrors = rows.slice(0, 5).map(r => ({
      message: r.msg_class,
      timestamp: new Date().toISOString(),
    }));
    const severity = errorCount > 100 ? 'critical' : errorCount > 50 ? 'high' : 'medium';
    emit({ DB: db as D1Database }, 'error.threshold', {
      tenantId: 'system',
      errorCount24h: errorCount,
      severity,
      sampleErrors,
    }, 'system');
  }

  const report =
    rows.length === 0
      ? `*[Sophia] Daily Error Digest — ${dateStr}*\n\nNo errors in the past 24 hours.`
      : `*[Sophia] Daily Error Digest — ${dateStr}*\n\n` +
        `Total errors: ${errorCount} across ${rows.length} unique fingerprints\n\n` +
        `*Top 3 to investigate:*\n${summary}`;

  const founderEmail = process.env.FOUNDER_EMAIL ?? '';
  if (founderEmail) {
    await sendFounderEmail(
      founderEmail,
      `[Sophia] Daily Error Digest — ${dateStr}`,
      report.replace(/\*/g, '')
    );
  }
  await sendTelegram(report);

  await recordCronRun(db as unknown as D1Database, CRON_NAME, 'success');

  finishCronCheckIn(cronCtx, CRON_NAME);
  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    errorCount,
    uniqueFingerprints: rows.length,
  });
}
