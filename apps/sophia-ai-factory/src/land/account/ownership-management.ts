/**
 * Account Ownership & Administration.
 * Manages organization ownership badges, 24h support access delegation, and team roles.
 *
 * @module land/account/ownership-management
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  listTeamMembers,
  inviteTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  type TeamRole,
  type TeamMember,
} from './ownership-team-members';

export {
  listTeamMembers,
  inviteTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  type TeamRole,
  type TeamMember,
};

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

export async function getAccountOwnershipDetails(userId: string): Promise<AccountOwnershipDetails> {
  const db = createServerClient();
  const defaultOrgId = `org_${userId}`;
  let isOwner = true;
  let role: TeamRole = 'OWNER';
  let orgId = defaultOrgId;
  let orgName = 'Personal Workspace';

  try {
    const memberRow = await db
      .prepare(
        `SELECT om.id, om.org_id, om.role, o.name as org_name
         FROM org_members om
         LEFT JOIN organizations o ON om.org_id = o.id
         WHERE om.user_id = ?1 LIMIT 1`,
      )
      .bind(userId)
      .first<{ id: string; org_id: string; role: string; org_name: string | null }>();

    if (memberRow) {
      orgId = memberRow.org_id;
      orgName = memberRow.org_name || 'Organization Workspace';
      const r = memberRow.role.toUpperCase();
      role = r === 'OWNER' || r === 'ADMIN' ? 'OWNER' : r === 'EDITOR' ? 'EDITOR' : 'VIEWER';
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
    const row = await db
      .prepare(`SELECT value FROM tenant_settings WHERE tenant_id = ?1 AND namespace = 'support_access' LIMIT 1`)
      .bind(orgId)
      .first<{ value: string }>();

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

  await db
    .prepare(
      `INSERT INTO tenant_settings (tenant_id, namespace, value, updated_at)
       VALUES (?1, 'support_access', ?2, datetime('now'))
       ON CONFLICT(tenant_id, namespace) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .bind(orgId, payload)
    .run();

  return { enabled: enable, expiresAt, grantedBy: enable ? userId : null };
}
