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
import { getD1Raw } from '@/seed/db/client';
import { revalidatePath } from 'next/cache';

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
    // UPSERT — many fresh MASTER FREE100 users have no user_profiles row yet
    // (the BYOK setup wizard creates that row only when keys are saved). A
    // plain UPDATE silently no-ops for those users and leaves them stuck in
    // the /dashboard → /dashboard/onboarding redirect loop. Insert-on-conflict
    // makes the flag durable regardless of prior profile state.
    const db = await getD1Raw();
    await db
      .prepare(
        `INSERT INTO user_profiles (user_id, onboarding_completed_at)
         VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET onboarding_completed_at = excluded.onboarding_completed_at`,
      )
      .bind(user.id, nowMs)
      .run();

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/onboarding');

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
