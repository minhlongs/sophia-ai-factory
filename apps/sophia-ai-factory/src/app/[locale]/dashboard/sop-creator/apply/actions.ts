'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/get-d1';

export interface ApplyFormState {
  success: boolean;
  error?: string;
  email?: string;
  reason?: string;
}

/**
 * Submit a creator application — inserts a row into user_beta_invites
 * with approved=0 for manual review.
 */
export async function submitCreatorApplication(
  _prev: ApplyFormState,
  formData: FormData,
): Promise<ApplyFormState> {
  const t = await getTranslations('sop.creator.apply');
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const db = getD1();
  if (!db) {
    return { success: false, error: t('errorGeneric') };
  }

  const email = formData.get('email') as string;
  const reason = formData.get('reason') as string;

  if (!email || !reason) {
    return { success: false, error: 'Email and reason are required.', email, reason };
  }

  try {
    const inviteCode = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO user_beta_invites (user_id, invite_code, approved)
         VALUES (?, ?, 0)`,
      )
      .bind(user.id, inviteCode)
      .run();

    return { success: true };
  } catch {
    return { success: false, error: t('errorGeneric'), email, reason };
  }
}
