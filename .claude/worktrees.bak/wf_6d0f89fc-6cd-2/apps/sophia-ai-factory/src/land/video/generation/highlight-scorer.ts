/**
 * Highlight Scorer — uses OpenRouter BYOK to identify viral clip segments
 * from a transcript (AssemblyAI format with timestamps).
 */

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';

export interface TranscriptSegment {
  text: string;
  start: number; // ms
  end: number;   // ms
}

export interface HighlightClip {
  start_ms: number;
  end_ms: number;
  score: number;  // 0.0–1.0 (average of all dimensions)
  hook_score?: number; // 0.0-1.0
  pacing_score?: number; // 0.0-1.0
  retention_score?: number; // 0.0-1.0
  cta_score?: number; // 0.0-1.0
  title: string;
  reasoning: string;
  caption?: string;
  hashtags?: string[];
  subtitle_style?: string;
  tone?: string;
}

interface LlmClipResponse {
  clips: Array<{
    start_ms: number;
    end_ms: number;
    score?: number;
    hook_score?: number;
    pacing_score?: number;
    retention_score?: number;
    cta_score?: number;
    title: string;
    reasoning: string;
    caption?: string;
    hashtags?: string[];
    subtitle_style?: string;
    tone?: string;
  }>;
}

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
      "hook_score": <float 0.0-1.0>,
      "pacing_score": <float 0.0-1.0>,
      "retention_score": <float 0.0-1.0>,
      "cta_score": <float 0.0-1.0>,
      "title": "<short catchy title>",
      "reasoning": "<why this clip is viral-worthy>",
      "caption": "<engaging caption optimized for social media>",
      "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
      "subtitle_style": "<recommended visual style: bold-yellow | kinetic-red | minimal-white>",
      "tone": "<detected tone: energetic | serious | humorous | inspirational>"
    }
  ]
}

Rules:
- Each clip must be 15,000ms–60,000ms long
- Hook score prioritizes strong opening statements/questions.
- Pacing score evaluates speed and keyword density.
- Retention score measures long-term interest retention.
- CTA score measures conclusion or action driver quality.
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

  try {
    const content = await resilientChatCompletion(prompt, {
      openRouterKey: apiKey,
      anthropicKey: undefined,
      enableFallback: false,
      model: SCORE_MODEL,
    });

    const jsonText = content.replace(/^```[a-z]*\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(jsonText) as LlmClipResponse;

    const clips = (parsed.clips ?? [])
      .filter((c) => c.end_ms - c.start_ms >= 15_000 && c.end_ms - c.start_ms <= 60_000)
      .map((c) => {
        const hook = c.hook_score ?? 0.5;
        const pacing = c.pacing_score ?? 0.5;
        const retention = c.retention_score ?? 0.5;
        const cta = c.cta_score ?? 0.5;
        const calculatedScore = c.score ?? (hook + pacing + retention + cta) / 4;
        return {
          ...c,
          score: Math.round(calculatedScore * 100) / 100,
          hook_score: hook,
          pacing_score: pacing,
          retention_score: retention,
          cta_score: cta,
        };
      });

    logger.info('[highlight-scorer] Scored highlights', { userId, clipsFound: clips.length });
    return clips;
  } catch (err) {
    logger.error('[highlight-scorer] failed', toError(err), { userId });
    throw err;
  }
}
