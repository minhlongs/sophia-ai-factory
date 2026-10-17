/**
 * Beta Creator Invite System — business logic for invite code lifecycle.
 *
 * Commission override (50% for 60 days) is stored in the invite row for
 * reference. Actual commission override enforcement is deferred to the
 * commission calculator integration.
 */

import {
  generateInviteCode,
  listInvites,
  isBetaInviteApproved,
  revokeInvite,
  type BetaInvite,
  type CreateBetaInviteInput,
  type ValidateInviteResult,
} from './beta-invites-queries';

export {
  generateInviteCode,
  listInvites,
  isBetaInviteApproved,
  revokeInvite,
  type BetaInvite,
  type CreateBetaInviteInput,
  type ValidateInviteResult,
};

/** Insert a new beta invite row. Returns the created invite. */
export async function createBetaInvite(
  db: D1Database,
  input: CreateBetaInviteInput,
): Promise<BetaInvite> {
  const id = crypto.randomUUID();
  const code = generateInviteCode();
  const now = Date.now();
  const commissionOverridePct = input.commissionOverridePct ?? 0.50;
  const maxUses = input.maxUses ?? 1;

  await db
    .prepare(
      `INSERT INTO beta_invites
        (id, code, email, commission_override_pct, max_uses, used_count, expires_at, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .bind(
      id,
      code,
      input.email ?? null,
      commissionOverridePct,
      maxUses,
      input.expiresAt ?? null,
      input.createdBy,
      now,
    )
    .run();

  return {
    id,
    code,
    email: input.email ?? null,
    commission_override_pct: commissionOverridePct,
    max_uses: maxUses,
    used_count: 0,
    expires_at: input.expiresAt ?? null,
    created_by: input.createdBy,
    created_at: now,
  };
}

/** Check whether an invite code is usable (exists, not expired, not exhausted). */
export async function validateInviteCode(
  db: D1Database,
  code: string,
): Promise<ValidateInviteResult> {
  const row = await db
    .prepare('SELECT * FROM beta_invites WHERE code = ?')
    .bind(code.toUpperCase())
    .first<BetaInvite>();

  if (!row) {
    return { valid: false, invite: null, reason: 'not_found' };
  }

  if (row.expires_at !== null && row.expires_at < Date.now()) {
    return { valid: false, invite: row, reason: 'expired' };
  }

  if (row.used_count >= row.max_uses) {
    return { valid: false, invite: row, reason: 'exhausted' };
  }

  return { valid: true, invite: row };
}

/**
 * Redeem an invite code for a user — increments used_count and records
 * the user-invite mapping in user_beta_invites.
 * Returns updated invite or throws if code is not valid.
 */
export async function redeemInviteCode(
  db: D1Database,
  code: string,
  userId: string,
): Promise<BetaInvite> {
  const { valid, invite, reason } = await validateInviteCode(db, code);

  if (!valid || !invite) {
    throw new Error(`Cannot redeem invite: ${reason ?? 'invalid'}`);
  }

  await db
    .prepare('UPDATE beta_invites SET used_count = used_count + 1 WHERE id = ?')
    .bind(invite.id)
    .run();

  await db
    .prepare(
      `INSERT INTO user_beta_invites (user_id, invite_code, approved, approved_at)
       VALUES (?, ?, 1, ?)`,
    )
    .bind(userId, invite.code, Date.now())
    .run();

  return { ...invite, used_count: invite.used_count + 1 };
}
