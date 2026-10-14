import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import { ErrorRow } from './types';

export async function callOpenRouter(fingerprints: ErrorRow[]): Promise<string> {
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

export async function sendTelegram(message: string): Promise<void> {
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

export async function sendFounderEmail(to: string, subject: string, body: string): Promise<void> {
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
