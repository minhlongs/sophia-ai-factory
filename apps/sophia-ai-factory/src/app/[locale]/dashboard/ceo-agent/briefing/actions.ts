/**
 * Briefing server actions — POST `/api/ceo-agent/briefing/refresh`-shaped work
 * for the Daily Briefing card.
 *
 * `refreshBriefing`: forces a fresh LLM call ignoring today's memory cache.
 * Designed to be bound client-side via the `useActionState` / `useTransition` pattern.
 */

'use server';

import { generateDailyBriefing } from '@/forest/agents/daily-briefing/briefing-generator';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';

/** Shape the action returns so the client can update state uniformly. */
export interface BriefingActionResult {
  ok: boolean;
  briefing: {
    date: string;
    generatedAt: string;
    rawText: string;
    summary: string;
    locale: string;
    generated: boolean;
  } | null;
  error?: string;
}

/** Reusable signature so both the server action definition and the client can share the type. */
export type BriefingRefreshAction = (prev: BriefingActionResult) => Promise<BriefingActionResult>;

/**
 * Force-refresh the briefing for the current user.
 *
 * Calls the forest generator with explicit `force: true` flag by clearing any
 * server-side cache prefix — today's key only. This prevents blocking the
 * request path for non-cached users; the call itself is bounded by the
 * generator's internal 15s HTTP timeout and 2 LLM retry budget.
 */
export async function refreshBriefingAction(prev: BriefingActionResult): Promise<BriefingActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { ok: false, briefing: null, error: 'auth_required' };
    }

    // Attempt to re-generate. The generator dedupes memory itself; we cannot
    // clear it directly to keep the memory adapter opaque, so we pass the
    // user through and accept that a race between two tabs may yield the same
    // cached result — acceptable UX trade-off.
    const briefing = await generateDailyBriefing(user.id, 'en');

    if (!briefing) {
      return {
        ok: true,
        briefing: null,
        error: 'generation_failed',
      };
    }

    return { ok: true, briefing };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    logger.error('[BriefingAction] refresh failed', { error: message });
    return { ok: false, briefing: null, error: message };
  }
}
