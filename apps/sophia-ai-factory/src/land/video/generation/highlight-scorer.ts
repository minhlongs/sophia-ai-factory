/**
 * Highlight Scorer — uses OpenRouter BYOK to identify viral clip segments
 * from a transcript (AssemblyAI format with timestamps).
 */

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import {
  SCORE_MODEL,
  buildTranscriptText,
  buildScorePrompt,
  normalizeScoredClips,
  type TranscriptSegment,
  type HighlightClip,
  type LlmClipResponse,
} from './highlight-scorer-prompt';

export type { TranscriptSegment, HighlightClip };

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
    const clips = normalizeScoredClips(parsed);

    logger.info('[highlight-scorer] Scored highlights', { userId, clipsFound: clips.length });
    return clips;
  } catch (err) {
    logger.error('[highlight-scorer] failed', toError(err), { userId });
    throw err;
  }
}
