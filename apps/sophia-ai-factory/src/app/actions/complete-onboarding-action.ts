'use server';

/**
 * Server Action: completeOnboardingAction
 *
 * Sets user_profiles.onboarding_completed_at = now (unix-ms INTEGER).
 * Used by:
 *   - SkipButton (explicit skip)
 *   - OnboardingPage (auto-complete when all 3 steps done)
 *
 * Security: userId from auth session — never trusts URL/form input.
 */

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { revalidatePath } from 'next/cache';
import type { QueryResult } from '@/seed/db/d1-query-types';

const inputSchema = z.object({
  /** Optional — caller may pass 'skip' or 'complete' for telemetry; not stored. */
  reason: z.enum(['skip', 'complete']).optional(),
});

export type CompleteOnboardingInput = z.infer<typeof inputSchema>;

export interface CompleteOnboardingResult {
  success: boolean;
  error?: string;
}

export async function completeOnboardingAction(
  input: CompleteOnboardingInput = {},
): Promise<CompleteOnboardingResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'unauthorized' };

  // Validate input (safe even if reason is omitted)
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'invalid_input' };

  const nowMs = Date.now(); // INTEGER unix-ms to match migration 0062

  try {
    const db = createServerClient();
    const { error: updateError }: QueryResult<Record<string, unknown>[]> = await db
      .from('user_profiles')
      .update({ onboarding_completed_at: nowMs })
      .eq('user_id', user.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/onboarding');

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
