export type { DailyBriefing } from '../briefing-types';
export { BRIEFING_MEMORY_TYPE, BRIEFING_KEY_PREFIX } from '../briefing-types';

/** Maximum retries for the LLM call. */
export const MAX_LLM_RETRIES = 2;

/** Briefing generation timeout in milliseconds. */
export const BRIEFING_TIMEOUT_MS = 15_000;

export interface BriefingSectionSummary {
  summary: string;
}
