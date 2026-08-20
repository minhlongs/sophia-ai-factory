'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';

export interface SubmitCreatorApplicationInput {
  website: string;
  niche: string;
  subscribers: string;
  monthlyViews: string;
  experience: string;
  whyJoin: string;
  sampleContent?: string;
}

interface ApplyError {
  code: 'NOT_AUTHENTICATED' | 'ALREADY_HAS_ACCESS' | 'VALIDATION_ERROR' | 'DB_ERROR';
  message: string;
}

export async function submitCreatorApplication(
  input: SubmitCreatorApplicationInput
): Promise<Result<{ applicationId: string }, ApplyError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Check if user already has access
    const { hasCreatorAccess } = await import('@/land/sop-marketplace');
    const hasAccess = await hasCreatorAccess(d1, user.id);
    if (hasAccess) {
      return failure({ code: 'ALREADY_HAS_ACCESS', message: 'You already have creator access' });
    }

    // Validate required fields
    if (!input.website || !input.niche || !input.subscribers || !input.monthlyViews || !input.experience || !input.whyJoin) {
      return failure({ code: 'VALIDATION_ERROR', message: 'All required fields must be filled' });
    }

    // Record the application in user_beta_invites with approved=0 (pending)
    const applicationId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await d1
      .prepare(
        `INSERT INTO user_beta_invites (user_id, invite_code, approved, created_at)
         VALUES (?, ?, 0, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           invite_code = excluded.invite_code,
           approved = 0,
           approved_at = NULL`
      )
      .bind(user.id, applicationId, now)
      .run();

    // Also store application details in beta_invites as a pending invite record
    const inviteCode = `APPLY_${applicationId.slice(0, 8).toUpperCase()}`;
    const inviteId = crypto.randomUUID();

    await d1
      .prepare(
        `INSERT INTO beta_invites (id, code, email, commission_override_pct, max_uses, used_count, expires_at, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        inviteId,
        inviteCode,
        null, // email
        0.50, // 50% commission override for beta
        1, // max_uses
        0, // used_count
        null, // no expiry
        user.id, // self-applied
        now
      )
      .run();

    // Store application details in JSON in beta_invites table (we can extend it later)
    // For now, we store it in the email field as JSON
    const applicationData = JSON.stringify({
      website: input.website,
      niche: input.niche,
      subscribers: input.subscribers,
      monthlyViews: input.monthlyViews,
      experience: input.experience,
      whyJoin: input.whyJoin,
      sampleContent: input.sampleContent,
      submittedAt: now,
    });

    await d1
      .prepare(
        `UPDATE beta_invites SET email = ? WHERE id = ?`
      )
      .bind(applicationData, inviteId)
      .run();

    logger.info('[SubmitCreatorApplication] Application submitted', {
      userId: user.id,
      applicationId,
      niche: input.niche,
      subscribers: input.subscribers,
    });

    return success({ applicationId });
  } catch (err) {
    logger.error('[SubmitCreatorApplication] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}