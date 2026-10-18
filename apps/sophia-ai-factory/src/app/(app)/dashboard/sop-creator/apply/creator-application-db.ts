/**
 * Creator Application D1 Persistence Helper
 *
 * @module app/(app)/dashboard/sop-creator/apply/creator-application-db
 */

import type { SubmitCreatorApplicationInput } from './actions';

export interface ApplyError {
  code:
    | 'NOT_AUTHENTICATED'
    | 'ALREADY_HAS_ACCESS'
    | 'VALIDATION_ERROR'
    | 'DB_ERROR'
    | 'MARKETPLACE_TEMPORARILY_UNAVAILABLE';
  message: string;
}

export function isValidCreatorApplicationInput(input: SubmitCreatorApplicationInput): boolean {
  return Boolean(
    input.website &&
      input.niche &&
      input.subscribers &&
      input.monthlyViews &&
      input.experience &&
      input.whyJoin,
  );
}

export async function persistCreatorApplicationInDb(
  d1: D1Database,
  userId: string,
  input: SubmitCreatorApplicationInput,
): Promise<string> {
  const applicationId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await d1
    .prepare(
      `INSERT INTO user_beta_invites (user_id, invite_code, approved, created_at)
       VALUES (?, ?, 0, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         invite_code = excluded.invite_code,
         approved = 0,
         approved_at = NULL`,
    )
    .bind(userId, applicationId, now)
    .run();

  const inviteCode = `APPLY_${applicationId.slice(0, 8).toUpperCase()}`;
  const inviteId = crypto.randomUUID();

  await d1
    .prepare(
      `INSERT INTO beta_invites (id, code, email, commission_override_pct, max_uses, used_count, expires_at, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(inviteId, inviteCode, null, 0.5, 1, 0, null, userId, now)
    .run();

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
    .prepare('UPDATE beta_invites SET email = ? WHERE id = ?')
    .bind(applicationData, inviteId)
    .run();

  return applicationId;
}
