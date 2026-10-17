/**
 * Beta Creator Invite Queries & Revocation
 *
 * @module land/sop-marketplace/beta-invites-queries
 */

export interface BetaInvite {
  id: string;
  code: string;
  email: string | null;
  commission_override_pct: number;
  max_uses: number;
  used_count: number;
  expires_at: number | null;
  created_by: string;
  created_at: number;
}

export interface CreateBetaInviteInput {
  email?: string;
  commissionOverridePct?: number;
  maxUses?: number;
  expiresAt?: number;
  createdBy: string;
}

export interface ValidateInviteResult {
  valid: boolean;
  invite: BetaInvite | null;
  reason?: 'not_found' | 'expired' | 'exhausted';
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Returns a random 8-character alphanumeric invite code (uppercase, no ambiguous chars). */
export function generateInviteCode(): string {
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const byte of bytes) {
    code += CODE_CHARS[byte % CODE_CHARS.length];
  }
  return code;
}

/** List all invites, optionally filtered by creator. */
export async function listInvites(
  db: D1Database,
  createdBy?: string,
): Promise<BetaInvite[]> {
  if (createdBy) {
    const result = await db
      .prepare('SELECT * FROM beta_invites WHERE created_by = ? ORDER BY created_at DESC')
      .bind(createdBy)
      .all<BetaInvite>();
    return result.results ?? [];
  }

  const result = await db
    .prepare('SELECT * FROM beta_invites ORDER BY created_at DESC')
    .all<BetaInvite>();
  return result.results ?? [];
}

/** Check whether a user has an approved beta invite. */
export async function isBetaInviteApproved(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT approved FROM user_beta_invites WHERE user_id = ?1')
    .bind(userId)
    .first<{ approved: number }>();
  return row?.approved === 1;
}

/** Delete an invite by id. */
export async function revokeInvite(db: D1Database, id: string): Promise<void> {
  await db
    .prepare('DELETE FROM beta_invites WHERE id = ?')
    .bind(id)
    .run();
}
