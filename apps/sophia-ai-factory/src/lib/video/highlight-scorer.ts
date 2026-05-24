/**
 * Highlight Scorer — uses OpenRouter BYOK to identify viral clip segments
 * from a transcript (AssemblyAI format with timestamps).
 */

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';

export interface TranscriptSegment {
  text: string;
  start: number; // ms
  end: number;   // ms
}

export interface HighlightClip {
  start_ms: number;
  end_ms: number;
  score: number;  // 0.0–1.0
  title: string;
  reasoning: string;
}

interface LlmClipResponse {
  clips: Array<{
    start_ms: number;
    end_ms: number;
    score: number;
    title: string;
    reasoning: string;
  }>;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SCORE_MODEL = 'openai/gpt-4o-mini';

function buildTranscriptText(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => `[${s.start}ms-${s.end}ms] ${s.text}`)
    .join('\n');
}

function buildScorePrompt(transcriptText: string): string {
  return `You are a viral short-form video editor. Analyze this video transcript and identify 5-10 segments that would make great 15-60 second viral shorts.

TRANSCRIPT:
${transcriptText}

Return ONLY valid JSON in this exact format:
{
  "clips": [
    {
      "start_ms": <integer>,
      "end_ms": <integer>,
      "score": <float 0.0-1.0>,
      "title": "<short catchy title>",
      "reasoning": "<why this clip is viral-worthy>"
    }
  ]
}

Rules:
- Each clip must be 15,000ms–60,000ms long
- Score 1.0 = perfect viral potential, 0.0 = no potential
- Prioritize: hooks, insights, emotional moments, controversy, humor
- Title should be ≤60 characters
- Return only the JSON, no other text`;
}

export async function scoreHighlights(
  userId: string,
  transcript: TranscriptSegment[],
): Promise<HighlightClip[]> {
  if (transcript.length === 0) {
    logger.warn('[highlight-scorer] Empty transcript, returning no clips');
    return [];
  }

  const apiKey = await resolveUserApiKey(
    userId,
    'openrouter',
    process.env.OPENROUTER_API_KEY,
  );

  if (!apiKey) {
    throw new Error('No OpenRouter API key available. Configure BYOK in Setup Wizard.');
  }

  const transcriptText = buildTranscriptText(transcript);
  const prompt = buildScorePrompt(transcriptText);

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://sophia.agencyos.network',
      'X-Title': 'Sophia AI Factory',
    },
    body: JSON.stringify({
      model: SCORE_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter scoring failed: ${response.status} ${errText}`);
  }

  const result = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  const content = result.choices?.[0]?.message?.content ?? '';

  let parsed: LlmClipResponse;
  try {
    // Strip markdown code fences if present
    const jsonText = content.replace(/^```[a-z]*\n?/m, '').replace(/\n?```$/m, '').trim();
    parsed = JSON.parse(jsonText) as LlmClipResponse;
  } catch (err) {
    logger.error('[highlight-scorer] Failed to parse LLM response', { content, err });
    throw new Error(`Failed to parse highlight scoring response: ${String(err)}`);
  }

  const clips = (parsed.clips ?? []).filter(
    (c) => c.end_ms - c.start_ms >= 15_000 && c.end_ms - c.start_ms <= 60_000,
  );

  logger.info('[highlight-scorer] Scored highlights', { userId, clipsFound: clips.length });
  return clips;
}
