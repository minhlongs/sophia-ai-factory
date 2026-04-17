/**
 * POST/GET /api/cron/error-digest
 * Daily 05:00 UTC — queries error_log, sends fingerprint-only summary to OpenRouter,
 * emails founder + Telegram message.
 * RED-TEAM #2: ONLY fingerprints+counts shipped to OpenRouter — NEVER raw stacks/messages.
 * RED-TEAM #3: CRON_SECRET auth required.
 * RED-TEAM #5: D1 failure → push fatal log to Better Stack, return early.
 * TODO: future migration to CF scheduled() handler removes HTTP exposure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pushFatalLog } from '@/lib/telemetry/better-stack-client';

export const dynamic = 'force-dynamic';

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
  const openRouterKey = process.env.OPENROUTER_API_KEY ?? '';
  if (!openRouterKey || !fingerprints.length) {
    return 'No errors in the past 24 hours.';
  }

  // RED-TEAM #2: ship ONLY class + fingerprint + count — no raw messages/stacks
  const input = fingerprints.map((r) => ({
    class: r.msg_class,
    fingerprint: r.fingerprint,
    count: r.c,
  }));

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a production reliability assistant. Given error fingerprints and counts (no raw messages), identify the top 3 error classes to investigate. Be concise — 3 bullet points max.',
        },
        {
          role: 'user',
          content: JSON.stringify(input),
        },
      ],
      max_tokens: 256,
    }),
  });

  if (!response.ok) return `OpenRouter error: ${response.status}`;
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? 'No summary available.';
}

async function sendTelegram(message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    });
  } catch {
    // Best-effort
  }
}

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;
  try {
    await fetch('https://api.resend.com/emails', {
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
  } catch {
    // Best-effort
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

  const bsConfig = {
    logsToken: process.env.BETTER_STACK_LOGS_TOKEN ?? '',
    ingestingHost: process.env.BETTER_STACK_INGESTING_HOST,
  };

  const db = (globalThis as unknown as GlobalEnv).DB;
  if (!db) {
    await pushFatalLog('D1_UNAVAILABLE', 'DB binding missing in error-digest', bsConfig);
    return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE' }, { status: 200 });
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
    const errMsg = d1Err instanceof Error ? d1Err.message : String(d1Err);
    // RED-TEAM #5: push fatal directly to BS, skip digest
    await pushFatalLog('D1_UNAVAILABLE', errMsg, bsConfig);
    return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE' }, { status: 200 });
  }

  // RED-TEAM #2: only fingerprints+counts to OpenRouter
  const summary = await callOpenRouter(rows);
  const errorCount = rows.reduce((acc, r) => acc + r.c, 0);
  const dateStr = new Date().toISOString().slice(0, 10);

  const report =
    rows.length === 0
      ? `*[Sophia] Daily Error Digest — ${dateStr}*\n\nNo errors in the past 24 hours.`
      : `*[Sophia] Daily Error Digest — ${dateStr}*\n\n` +
        `Total errors: ${errorCount} across ${rows.length} unique fingerprints\n\n` +
        `*Top 3 to investigate:*\n${summary}`;

  const founderEmail = process.env.FOUNDER_EMAIL ?? '';
  if (founderEmail) {
    await sendEmail(
      founderEmail,
      `[Sophia] Daily Error Digest — ${dateStr}`,
      report.replace(/\*/g, '')
    );
  }
  await sendTelegram(report);

  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    errorCount,
    uniqueFingerprints: rows.length,
  });
}
