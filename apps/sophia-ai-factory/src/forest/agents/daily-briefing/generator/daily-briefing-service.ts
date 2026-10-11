import { memory } from '@/land/openclaw/memory-adapter';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { DailyBriefing } from './types';
import { BRIEFING_MEMORY_TYPE } from './types';
import { getTodayKey, parseBriefingSections } from './prompt-assembler';
import { callLlmForBriefing } from './briefing-synthesizer';

/**
 * Generate a daily briefing for a user.
 *
 * Checks for an existing briefing in agent memory first (once-per-day cache).
 * If none exists, calls the LLM to generate a new briefing.
 * Stores the result in agent memory for subsequent loads.
 *
 * @param userId — the user's ID
 * @param locale — the user's locale (for bilingual output)
 * @returns the DailyBriefing, or null if generation failed
 */
export async function generateDailyBriefing(
  userId: string,
  locale = 'en',
): Promise<DailyBriefing | null> {
  const todayKey = getTodayKey();

  // Check memory cache first
  try {
    const cached = (await memory.query(
      BRIEFING_MEMORY_TYPE,
      todayKey,
      userId,
    )) as DailyBriefing | null;

    if (cached && cached.generated) {
      logger.debug('[DailyBriefing] Returning cached briefing', {
        userId,
        date: cached.date,
      });
      return cached;
    }
  } catch (err) {
    // Memory unavailable — proceed with fresh generation
    logger.warn('[DailyBriefing] Memory query failed, generating fresh', {
      error: getErrorMessage(err),
    });
  }

  // Generate fresh briefing via LLM
  const rawText = await callLlmForBriefing(userId, locale);

  const summary = rawText ? parseBriefingSections(rawText).summary : '';
  const generated = rawText !== null;

  const briefing: DailyBriefing = {
    date: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    rawText: rawText ?? 'Daily briefing generation is not yet available. Configure your LLM API keys in Settings > Setup Wizard to enable AI-powered briefings.',
    summary,
    locale,
    generated,
  };

  // Store in memory (fire-and-forget — non-critical)
  if (generated) {
    try {
      await memory.store(BRIEFING_MEMORY_TYPE, todayKey, briefing, userId);
      logger.info('[DailyBriefing] Stored new briefing', { userId, date: briefing.date });
    } catch (err) {
      logger.warn('[DailyBriefing] Failed to store briefing in memory', {
        error: getErrorMessage(err),
      });
    }
  }

  return briefing;
}
