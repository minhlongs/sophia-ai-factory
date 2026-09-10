/**
 * Account Ownership & Administration.
 * Manages organization ownership badges, 24h support access delegation, and team roles.
 *
 * @module land/account/ownership-management
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export type TeamRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface TeamMember {
  id: string;
  orgId: string;
  userId: string;
  email: string;
  role: TeamRole;
  joinedAt: string;
}

export interface SupportAccessState {
  enabled: boolean;
  expiresAt: string | null;
  grantedBy: string | null;
}

export interface AccountOwnershipDetails {
  isOwner: boolean;
  orgId: string;
  orgName: string;
  role: TeamRole;
  supportAccess: SupportAccessState;
}

interface OrgMemberRow {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string | null;
}

export async function getAccountOwnershipDetails(userId: string): Promise<AccountOwnershipDetails> {
  const db = createServerClient();
  const defaultOrgId = `org_${userId}`;
  let isOwner = true;
  let role: TeamRole = 'OWNER';
  let orgId = defaultOrgId;
  let orgName = 'Personal Workspace';

  try {
    const memberRow = await db.prepare(
      `SELECT om.id, om.org_id, om.role, o.name as org_name
       FROM org_members om
       LEFT JOIN organizations o ON om.org_id = o.id
       WHERE om.user_id = ?1 LIMIT 1`,
    ).bind(userId).first<{ id: string; org_id: string; role: string; org_name: string | null }>();

    if (memberRow) {
      orgId = memberRow.org_id;
      orgName = memberRow.org_name || 'Organization Workspace';
      const r = memberRow.role.toUpperCase();
      role = (r === 'OWNER' || r === 'ADMIN') ? 'OWNER' : (r === 'EDITOR' ? 'EDITOR' : 'VIEWER');
      isOwner = role === 'OWNER';
    }

    const supportAccess = await getSupportAccessState(orgId);
    return { isOwner, orgId, orgName, role, supportAccess };
  } catch (err) {
    logger.warn('[OwnershipManagement] Failed to get ownership details', { userId, error: toError(err).message });
    return { isOwner, orgId, orgName, role, supportAccess: { enabled: false, expiresAt: null, grantedBy: null } };
  }
}

export async function getSupportAccessState(orgId: string): Promise<SupportAccessState> {
  try {
    const db = createServerClient();
    const row = await db.prepare(
      `SELECT value FROM tenant_settings WHERE tenant_id = ?1 AND namespace = 'support_access' LIMIT 1`,
    ).bind(orgId).first<{ value: string }>();

    if (!row?.value) return { enabled: false, expiresAt: null, grantedBy: null };
    const parsed = JSON.parse(row.value) as { expiresAt?: string; grantedBy?: string };
    if (!parsed.expiresAt) return { enabled: false, expiresAt: null, grantedBy: null };

    const isActive = new Date(parsed.expiresAt).getTime() > Date.now();
    return {
      enabled: isActive,
      expiresAt: isActive ? parsed.expiresAt : null,
      grantedBy: isActive ? (parsed.grantedBy ?? null) : null,
    };
  } catch {
    return { enabled: false, expiresAt: null, grantedBy: null };
  }
}

export async function toggleSupportAccess(userId: string, orgId: string, enable: boolean): Promise<SupportAccessState> {
  const db = createServerClient();
  const expiresAt = enable ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
  const payload = JSON.stringify({ enabled: enable, expiresAt, grantedBy: enable ? userId : null });

  await db.prepare(
    `INSERT INTO tenant_settings (tenant_id, namespace, value, updated_at)
     VALUES (?1, 'support_access', ?2, datetime('now'))
     ON CONFLICT(tenant_id, namespace) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).bind(orgId, payload).run();

  return { enabled: enable, expiresAt, grantedBy: enable ? userId : null };
}

export async function listTeamMembers(userId: string, orgId: string): Promise<TeamMember[]> {
  const db = createServerClient();
  try {
    const rows = await db.prepare(
      `SELECT om.id, om.org_id, om.user_id, om.role, om.created_at, u.email
       FROM org_members om
       LEFT JOIN users u ON om.user_id = u.id
       WHERE om.org_id = ?1
       ORDER BY om.created_at ASC`,
    ).bind(orgId).all<OrgMemberRow>();

    return (rows.results ?? []).map((r) => ({
      id: r.id,
      orgId: r.org_id,
      userId: r.user_id,
      email: r.email || `user_${r.user_id.slice(0, 6)}@sophia.agency`,
      role: r.role.toUpperCase() === 'OWNER' ? 'OWNER' : (r.role.toUpperCase() === 'EDITOR' ? 'EDITOR' : 'VIEWER'),
      joinedAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function inviteTeamMember(
  inviterUserId: string,
  orgId: string,
  email: string,
  role: 'EDITOR' | 'VIEWER',
): Promise<TeamMember> {
  const db = createServerClient();
  const newMemberId = `mbr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const placeholderUserId = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  await db.prepare(
    `INSERT INTO org_members (id, org_id, user_id, role, created_at)
     VALUES (?1, ?2, ?3, ?4, datetime('now'))`,
  ).bind(newMemberId, orgId, placeholderUserId, role.toLowerCase()).run();

  return {
    id: newMemberId,
    orgId,
    userId: placeholderUserId,
    email,
    role,
    joinedAt: new Date().toISOString(),
  };
}

export async function updateTeamMemberRole(
  inviterUserId: string,
  orgId: string,
  memberId: string,
  role: 'EDITOR' | 'VIEWER',
): Promise<boolean> {
  const db = createServerClient();
  const res = await db.prepare(
    `UPDATE org_members SET role = ?1 WHERE id = ?2 AND org_id = ?3`,
  ).bind(role.toLowerCase(), memberId, orgId).run();
  return Boolean(res.meta?.changes && res.meta.changes > 0);
}

export async function removeTeamMember(
  inviterUserId: string,
  orgId: string,
  memberId: string,
): Promise<boolean> {
  const db = createServerClient();
  const res = await db.prepare(
    `DELETE FROM org_members WHERE id = ?1 AND org_id = ?2 AND role != 'owner'`,
  ).bind(memberId, orgId).run();
  return Boolean(res.meta?.changes && res.meta.changes > 0);
}
