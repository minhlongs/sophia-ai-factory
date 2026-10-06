/**
 * Organization Invitation Domain Service
 *
 * Implements the complete cryptographic invitation lifecycle:
 * - Generation with 256-bit CSPRNG token and SHA-256 hash storage
 * - 7-day TTL enforcement
 * - Pre-flight and post-flight Seat Quota verification
 * - Single-use atomic acceptance and member role assignment
 * - Dual-table schema compatibility (org_invitations / organization_invitations)
 *
 * Layer: tree/organizations (Pure domain logic - only imports from @/seed)
 *
 * @module tree/organizations/invitation-service
 */

import type { D1Database } from '@/seed/db/client';
import { generateInvitationToken, sha256Hex, INVITATION_TTL_MS } from '@/seed/security/invitation-token';
import { checkSeatQuota } from './seat-quota-engine';
import type { OrgRole } from '@/seed/types/rbac-matrix';
import type {
  CreateInvitationInput,
  CreateInvitationResult,
  AcceptInvitationResult,
  OrgInvitationRecord,
} from '@/seed/types/org-invitations';

export type { CreateInvitationInput, CreateInvitationResult, AcceptInvitationResult, OrgInvitationRecord };

/**
 * Creates a new organization invitation with a cryptographic 256-bit single-use token.
 * Supports both input object and positional argument signatures.
 */
interface NormalizedInvitationParams {
  orgId: string;
  email: string;
  role: OrgRole;
  invitedByUserId: string;
  appBaseUrl?: string;
}

function normalizeInvitationParams(
  orgIdOrInput: string | CreateInvitationInput,
  emailArg?: string,
  roleArg?: OrgRole,
  invitedByUserIdArg?: string,
  appBaseUrlArg?: string,
): NormalizedInvitationParams {
  const isObject = typeof orgIdOrInput === 'object';
  const orgId = isObject ? orgIdOrInput.orgId : orgIdOrInput;
  const rawEmail = isObject ? orgIdOrInput.email : (emailArg ?? '');
  const role: OrgRole = isObject ? orgIdOrInput.role : (roleArg ?? 'viewer');
  const invitedByUserId = isObject ? orgIdOrInput.invitedByUserId : (invitedByUserIdArg ?? 'system');
  const appBaseUrl = isObject ? orgIdOrInput.appBaseUrl : appBaseUrlArg;

  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('VALIDATION_ERROR: A valid email address is required');
  }

  return { orgId, email, role, invitedByUserId, appBaseUrl };
}

interface InsertInvitationParams {
  invitationId: string;
  orgId: string;
  email: string;
  role: OrgRole;
  tokenHash: string;
  expiresAt: number;
  invitedByUserId: string;
  now: number;
  maxSeats: number;
  allocated: number;
}

async function tryInsertOrgInvitations(
  db: D1Database,
  memTable: 'organization_members' | 'org_members',
  params: InsertInvitationParams,
): Promise<boolean> {
  try {
    const res = await db
      .prepare(
        `INSERT INTO org_invitations
         (id, org_id, email, role, token_hash, expires_at, created_by, created_at, status)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending'
         WHERE (
           (SELECT COUNT(*) FROM ${memTable} WHERE org_id = ?2) +
           (SELECT COUNT(*) FROM org_invitations WHERE org_id = ?2 AND status = 'pending' AND expires_at > ?8)
         ) < ?9`
      )
      .bind(
        params.invitationId,
        params.orgId,
        params.email,
        params.role,
        params.tokenHash,
        params.expiresAt,
        params.invitedByUserId,
        params.now,
        params.maxSeats,
      )
      .run();

    const changes = res.meta?.changes ?? (res as { changes?: number }).changes ?? 0;
    if (changes === 0) {
      throw new Error(`SEAT_QUOTA_EXCEEDED: Org has reached seat limit (${params.allocated}/${params.maxSeats})`);
    }
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('SEAT_QUOTA_EXCEEDED') || msg.toLowerCase().includes('unique')) {
      throw err;
    }
    return false;
  }
}

async function tryInsertOrganizationInvitations(
  db: D1Database,
  memTable: 'organization_members' | 'org_members',
  params: InsertInvitationParams,
): Promise<boolean> {
  try {
    const res = await db
      .prepare(
        `INSERT INTO organization_invitations
         (id, org_id, email, role, token_hash, invited_by, expires_at, status, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8
         WHERE (
           (SELECT COUNT(*) FROM ${memTable} WHERE org_id = ?2) +
           (SELECT COUNT(*) FROM organization_invitations WHERE org_id = ?2 AND status = 'pending' AND expires_at > ?8)
         ) < ?9`
      )
      .bind(
        params.invitationId,
        params.orgId,
        params.email,
        params.role,
        params.tokenHash,
        params.invitedByUserId,
        params.expiresAt,
        params.now,
        params.maxSeats,
      )
      .run();

    const changes = res.meta?.changes ?? (res as { changes?: number }).changes ?? 0;
    if (changes === 0) {
      throw new Error(`SEAT_QUOTA_EXCEEDED: Org has reached seat limit (${params.allocated}/${params.maxSeats})`);
    }
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('SEAT_QUOTA_EXCEEDED') || msg.toLowerCase().includes('unique')) {
      throw err;
    }
    return false;
  }
}

async function insertInvitationWithFallback(db: D1Database, params: InsertInvitationParams): Promise<void> {
  if (await tryInsertOrgInvitations(db, 'organization_members', params)) return;
  if (await tryInsertOrganizationInvitations(db, 'organization_members', params)) return;
  if (await tryInsertOrgInvitations(db, 'org_members', params)) return;
  await tryInsertOrganizationInvitations(db, 'org_members', params);
}

/**
 * Creates a new organization invitation with a cryptographic 256-bit single-use token.
 * Supports both input object and positional argument signatures.
 */
export async function createOrgInvitation(
  db: D1Database,
  orgIdOrInput: string | CreateInvitationInput,
  emailArg?: string,
  roleArg?: OrgRole,
  invitedByUserIdArg?: string,
  appBaseUrlArg?: string,
): Promise<CreateInvitationResult> {
  const { orgId, email, role, invitedByUserId, appBaseUrl } = normalizeInvitationParams(
    orgIdOrInput,
    emailArg,
    roleArg,
    invitedByUserIdArg,
    appBaseUrlArg,
  );

  // 1. Enforce seat quota before generating invitation
  const quota = await checkSeatQuota(db, orgId);
  if (!quota.isAllowed) {
    throw new Error(`SEAT_QUOTA_EXCEEDED: Org has reached seat limit (${quota.allocated}/${quota.maxSeats})`);
  }

  // 2. Generate 256-bit CSPRNG token (64 hex chars) and SHA-256 hash
  const { rawToken, tokenHash, expiresAt } = await generateInvitationToken(INVITATION_TTL_MS);
  const now = Date.now();
  const invitationId = `inv_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  // 3. Persist to database with atomic quota enforcement guarding against TOCTOU race conditions
  await insertInvitationWithFallback(db, {
    invitationId,
    orgId,
    email,
    role,
    tokenHash,
    expiresAt,
    invitedByUserId,
    now,
    maxSeats: quota.maxSeats,
    allocated: quota.allocated,
  });

  const baseUrl = appBaseUrl || 'https://sophia.agencyos.network';
  const inviteUrl = `${baseUrl}/invitations/accept?token=${rawToken}`;

  return {
    invitationId,
    inviteUrl,
    token: rawToken,
    expiresAt,
  };
}

interface OrgInvitationLookup {
  id: string;
  org_id: string;
  email: string;
  role: OrgRole;
  status: string;
  expires_at: number;
}

async function findInvitationByTokenHash(
  db: D1Database,
  tokenHash: string,
): Promise<{ invitation: OrgInvitationLookup; targetTable: string } | null> {
  for (const table of ['org_invitations', 'organization_invitations']) {
    try {
      const row = await db
        .prepare(`SELECT id, org_id, email, role, status, expires_at FROM ${table} WHERE token_hash = ?1 LIMIT 1`)
        .bind(tokenHash)
        .first<OrgInvitationLookup>();
      if (row) {
        return { invitation: row, targetTable: table };
      }
    } catch {
      // Continue to next candidate table
    }
  }
  return null;
}

async function claimInvitationCas(
  db: D1Database,
  invitation: OrgInvitationLookup,
  targetTable: string,
  now: number,
): Promise<void> {
  if (invitation.status !== 'pending') {
    const err = new Error(`INVITATION_ALREADY_USED: Invitation has status '${invitation.status}' (TOKEN_ALREADY_USED)`) as Error & { code?: string };
    err.code = 'TOKEN_ALREADY_USED';
    throw err;
  }

  if (now > invitation.expires_at) {
    await db
      .prepare(`UPDATE ${targetTable} SET status = 'expired' WHERE id = ?1`)
      .bind(invitation.id)
      .run();
    throw new Error(`INVITATION_EXPIRED: Token expired at ${invitation.expires_at} (TOKEN_EXPIRED)`);
  }

  const quota = await checkSeatQuota(db, invitation.org_id);
  if (quota.activeMembers >= quota.maxSeats) {
    throw new Error(`SEAT_QUOTA_EXCEEDED: Organization is full (${quota.allocated}/${quota.maxSeats})`);
  }

  const updateResult = await db
    .prepare(
      `UPDATE ${targetTable}
       SET status = 'accepted', accepted_at = ?1
       WHERE id = ?2 AND status = 'pending'`
    )
    .bind(now, invitation.id)
    .run();

  const changes = updateResult.meta?.changes ?? (updateResult as { changes?: number }).changes ?? 0;
  if (changes === 0) {
    const err = new Error('INVITATION_ALREADY_USED: Invitation has already been accepted or is no longer pending (TOKEN_ALREADY_USED)') as Error & { code?: string };
    err.code = 'TOKEN_ALREADY_USED';
    throw err;
  }
}

async function rollbackCasClaim(db: D1Database, targetTable: string, invitationId: string): Promise<void> {
  try {
    await db
      .prepare(`UPDATE ${targetTable} SET status = 'pending', accepted_at = NULL WHERE id = ?1`)
      .bind(invitationId)
      .run();
  } catch {}
}

async function insertMemberToOrganizationMembers(
  db: D1Database,
  invitation: OrgInvitationLookup,
  userId: string,
  memberId: string,
  now: number,
): Promise<boolean> {
  try {
    const insertResult = await db
      .prepare(
        `INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6
         WHERE (SELECT COUNT(*) FROM organization_members WHERE org_id = ?2) < (
           SELECT COALESCE(max_seats, 5) FROM organizations WHERE id = ?2
         )`
      )
      .bind(memberId, invitation.org_id, userId, invitation.role, now, now)
      .run();

    const insertChanges = insertResult.meta?.changes ?? (insertResult as { changes?: number }).changes ?? 0;
    if (insertChanges === 0) {
      throw new Error('SEAT_QUOTA_EXCEEDED: Organization is full');
    }
    return true;
  } catch (err: unknown) {
    const errStr = err instanceof Error ? err.message : String(err);
    if (errStr.includes('SEAT_QUOTA_EXCEEDED') || errStr.toLowerCase().includes('unique')) {
      throw err;
    }
    return false;
  }
}

async function insertMemberToOrgMembers(
  db: D1Database,
  invitation: OrgInvitationLookup,
  userId: string,
  memberId: string,
  now: number,
): Promise<void> {
  const insertResult = await db
    .prepare(
      `INSERT INTO org_members (id, org_id, user_id, role, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5
       WHERE (SELECT COUNT(*) FROM org_members WHERE org_id = ?2) < (
         SELECT COALESCE(max_seats, 5) FROM organizations WHERE id = ?2
       )`
    )
    .bind(memberId, invitation.org_id, userId, invitation.role, now)
    .run();

  const insertChanges = insertResult.meta?.changes ?? (insertResult as { changes?: number }).changes ?? 0;
  if (insertChanges === 0) {
    throw new Error('SEAT_QUOTA_EXCEEDED: Organization is full');
  }
}

async function insertMemberWithRollback(
  db: D1Database,
  targetTable: string,
  invitation: OrgInvitationLookup,
  userId: string,
  now: number,
): Promise<void> {
  const memberId = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  try {
    const inserted = await insertMemberToOrganizationMembers(db, invitation, userId, memberId, now);
    if (!inserted) {
      await insertMemberToOrgMembers(db, invitation, userId, memberId, now);
    }
  } catch (err: unknown) {
    await rollbackCasClaim(db, targetTable, invitation.id);
    throw err;
  }
}

/**
 * Accepts an organization invitation, atomically consumes the token, and creates a member.
 * Re-validates seat quota at time of acceptance to prevent oversubscription races.
 */
export async function acceptOrgInvitation(
  db: D1Database,
  token: string,
  userId: string,
): Promise<AcceptInvitationResult> {
  const tokenHash = await sha256Hex(token.trim());
  const now = Date.now();

  const found = await findInvitationByTokenHash(db, tokenHash);
  if (!found) {
    throw new Error('INVALID_INVITATION_TOKEN: Invitation token not found (TOKEN_NOT_FOUND)');
  }

  const { invitation, targetTable } = found;

  await claimInvitationCas(db, invitation, targetTable, now);
  await insertMemberWithRollback(db, targetTable, invitation, userId, now);

  return {
    success: true,
    orgId: invitation.org_id,
    role: invitation.role,
  };
}

/**
 * Revokes a pending organization invitation.
 */
export async function revokeOrgInvitation(
  db: D1Database,
  invitationId: string,
  orgId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE org_invitations
       SET status = 'revoked'
       WHERE id = ?1 AND org_id = ?2 AND status = 'pending'`
    )
    .bind(invitationId, orgId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}
