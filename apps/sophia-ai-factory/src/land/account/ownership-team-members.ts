/**
 * Team member CRUD operations for Account Ownership & Administration.
 * @module land/account/ownership-team-members
 */

import { createServerClient } from '@/seed/db/client';

export type TeamRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface TeamMember {
  id: string;
  orgId: string;
  userId: string;
  email: string;
  role: TeamRole;
  joinedAt: string;
}

interface OrgMemberRow {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string | null;
}

export async function listTeamMembers(_userId: string, orgId: string): Promise<TeamMember[]> {
  const db = createServerClient();
  try {
    const rows = await db
      .prepare(
        `SELECT om.id, om.org_id, om.user_id, om.role, om.created_at, u.email
         FROM org_members om
         LEFT JOIN users u ON om.user_id = u.id
         WHERE om.org_id = ?1
         ORDER BY om.created_at ASC`,
      )
      .bind(orgId)
      .all<OrgMemberRow>();

    return (rows.results ?? []).map((r) => ({
      id: r.id,
      orgId: r.org_id,
      userId: r.user_id,
      email: r.email || `user_${r.user_id.slice(0, 6)}@sophia.agency`,
      role: r.role.toUpperCase() === 'OWNER' ? 'OWNER' : r.role.toUpperCase() === 'EDITOR' ? 'EDITOR' : 'VIEWER',
      joinedAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function inviteTeamMember(
  _inviterUserId: string,
  orgId: string,
  email: string,
  role: 'EDITOR' | 'VIEWER',
): Promise<TeamMember> {
  const db = createServerClient();
  const newMemberId = `mbr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const placeholderUserId = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  await db
    .prepare(
      `INSERT INTO org_members (id, org_id, user_id, role, created_at)
       VALUES (?1, ?2, ?3, ?4, datetime('now'))`,
    )
    .bind(newMemberId, orgId, placeholderUserId, role.toLowerCase())
    .run();

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
  _inviterUserId: string,
  orgId: string,
  memberId: string,
  role: 'EDITOR' | 'VIEWER',
): Promise<boolean> {
  const db = createServerClient();
  const res = await db
    .prepare(`UPDATE org_members SET role = ?1 WHERE id = ?2 AND org_id = ?3`)
    .bind(role.toLowerCase(), memberId, orgId)
    .run();
  return Boolean(res.meta?.changes && res.meta.changes > 0);
}

export async function removeTeamMember(
  _inviterUserId: string,
  orgId: string,
  memberId: string,
): Promise<boolean> {
  const db = createServerClient();
  const res = await db
    .prepare(`DELETE FROM org_members WHERE id = ?1 AND org_id = ?2 AND role != 'owner'`)
    .bind(memberId, orgId)
    .run();
  return Boolean(res.meta?.changes && res.meta.changes > 0);
}
