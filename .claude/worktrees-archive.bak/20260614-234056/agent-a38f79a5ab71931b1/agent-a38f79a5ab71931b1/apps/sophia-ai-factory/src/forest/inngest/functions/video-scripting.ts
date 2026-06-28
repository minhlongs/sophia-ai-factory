/**
 * Inngest Function: videoScripting
 * @deprecated 2026-05-17 (ADR 0007) — removed from serve registration. `video_jobs` table was never applied to prod D1. File kept for test coverage + historical context.
 *
 * Listens: video.requested
 * Transition: queued → scripting
 * Generates video script via OpenRouter API (real LLM call).
 * Emits: video.script.ready
 */

import { inngest } from '@/forest/inngest/client';
import { getD1Client } from '@/seed/db/client';
import { recordCost } from '@/land/video/cost-ledger';
import { assertValidTransition } from '@/land/video/video-job-fsm';
import { logger } from '@/seed/utils/logger-utility';
import type { VideoJobStatus } from '@/land/video/video-job-fsm';

interface VideoJobRow {
  status: VideoJobStatus;
  prompt: string;
}

const SCRIPT_SYSTEM_PROMPT = `You are a professional video script writer for Sophia AI Factory.
Write a concise, engaging video script (60-90 seconds when spoken) based on the user's prompt.
Include scene descriptions in [brackets] and narrator text.
Output in Vietnamese by default unless the prompt is in English.`;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('[videoScripting] OPENROUTER_API_KEY not configured — job cannot proceed');
  }
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: SCRIPT_SYSTEM_PROMPT },
        { role: 'user', content: `Write a video script for: ${prompt}` },
      ],
      max_tokens: 800,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text().catch(() => '')}`);
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? '[Empty response]';
}

export const videoScripting = inngest.createFunction(
  { id: 'video-scripting', retries: 3 },
  { event: 'video.requested' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    const job = await step.run('load-job', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status, prompt')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoScripting] Job not found: ${jobId}`);
      return row;
    });

    await step.run('transition-to-scripting', async () => {
      assertValidTransition(job.status, 'scripting');
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({ status: 'scripting', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    let scriptText: string;
    await step.run('generate-script', async () => {
      scriptText = await callOpenRouter(job.prompt);
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({ script_text: scriptText, updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'scripting', provider: 'openrouter', units: 1, costUsd: 0.002 });
    });

    await step.sendEvent('emit-script-ready', {
      name: 'video.script.ready',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'scripting' };
  },
);
