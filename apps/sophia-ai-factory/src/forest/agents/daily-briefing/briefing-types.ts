/**
 * @module forest/agents/daily-briefing/briefing-types
 *
 * Types for the CEO Agent Daily Briefing feature.
 * The briefing is generated once per day per user and cached in agent memory.
 */

/** Structured daily briefing from the CEO Agent. */
export interface DailyBriefing {
  /** ISO date string for the briefing date (YYYY-MM-DD). */
  date: string;
  /** ISO timestamp when the briefing was generated. */
  generatedAt: string;
  /** Raw markdown content of the full briefing. */
  rawText: string;
  /** Parsed summary section of the briefing. */
  summary: string;
  /** Brief locale code (en/vi). */
  locale: string;
  /** Whether the LLM call succeeded. */
  generated: boolean;
}

/** Memory storage constants. */
export const BRIEFING_MEMORY_TYPE = 'agent' as const;
export const BRIEFING_KEY_PREFIX = 'daily-briefing:';
