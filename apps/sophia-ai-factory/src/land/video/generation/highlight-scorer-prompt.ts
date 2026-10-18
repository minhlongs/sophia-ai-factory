/**
 * Prompt Builder & Clip Normalization for Highlight Scorer.
 *
 * @module land/video/generation/highlight-scorer-prompt
 */

import { calculateHookScore } from '@/tree/trend-intelligence/hook-scorer';

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

export interface LlmClipResponse {
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

export const SCORE_MODEL = 'openai/gpt-4o-mini';

export function buildTranscriptText(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => `[${s.start}ms-${s.end}ms] ${s.text}`)
    .join('\n');
}

export function buildScorePrompt(transcriptText: string): string {
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

export function normalizeScoredClips(parsed: LlmClipResponse): HighlightClip[] {
  return (parsed.clips ?? [])
    .filter((c) => c.end_ms - c.start_ms >= 15_000 && c.end_ms - c.start_ms <= 60_000)
    .map((c) => {
      const hook = c.hook_score ?? 0.5;
      const pacing = c.pacing_score ?? 0.5;
      const retention = c.retention_score ?? 0.5;
      const cta = c.cta_score ?? 0.5;
      const evaluation = calculateHookScore({
        hookText: c.title,
        scores: {
          hookScore: hook,
          pacingScore: pacing,
          retentionScore: retention,
          ctaScore: cta,
        },
      });
      const calculatedScore = c.score ?? evaluation.viralScore;
      return {
        ...c,
        score: Math.round(calculatedScore * 100) / 100,
        hook_score: hook,
        pacing_score: pacing,
        retention_score: retention,
        cta_score: cta,
      };
    });
}
