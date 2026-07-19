/**
 * Beta Creator Invite System — business logic for invite code lifecycle.
 *
 * Commission override (50% for 60 days) is stored in the invite row for
 * reference. Actual commission override enforcement is deferred to the
 * commission calculator integration.
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

export interface ValidateInviteResult {
  valid: boolean;
  invite: BetaInvite | null;
  reason?: 'not_found' | 'expired' | 'exhausted';
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
 * Redeem an invite code for a user — increments used_count.
 * Returns updated invite or throws if code is not valid.
 */
export async function redeemInviteCode(
  db: D1Database,
  code: string,
  _userId: string,
): Promise<BetaInvite> {
  const { valid, invite, reason } = await validateInviteCode(db, code);

  if (!valid || !invite) {
    throw new Error(`Cannot redeem invite: ${reason ?? 'invalid'}`);
  }

  await db
    .prepare('UPDATE beta_invites SET used_count = used_count + 1 WHERE id = ?')
    .bind(invite.id)
    .run();

  return { ...invite, used_count: invite.used_count + 1 };
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

/** Delete an invite by id. */
export async function revokeInvite(db: D1Database, id: string): Promise<void> {
  await db
    .prepare('DELETE FROM beta_invites WHERE id = ?')
    .bind(id)
    .run();
}
