/**
 * Workspace Membership & Tenant ID Resolution
 *
 * Layer: seed/auth
 */

import * as dbClientModule from '@/seed/db/client';
import type { D1Client, D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { normalizeWorkspaceRole, type WorkspaceRole } from './roles';

export function resolveClient(db?: D1Client | D1Database | { prepare: unknown }): D1Client {
  if (db) {
    return db as unknown as D1Client;
  }
  if (typeof dbClientModule.createServerClient === 'function') {
    return dbClientModule.createServerClient();
  }
  return {} as D1Client;
}

/**
 * Retrieves the user's membership role for the given workspace.
 * Returns { role } if member, or null if not found/error occurs.
 */
export async function getWorkspaceMembership(
  workspaceId: string,
  userId: string,
  db?: D1Client | D1Database
): Promise<{ role: WorkspaceRole } | null> {
  if (!workspaceId || !userId) {
    return null;
  }
  try {
    const client = resolveClient(db);
    const row = await client
      .prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ? LIMIT 1')
      .bind(workspaceId, userId)
      .first<{ role?: string } | Record<string, unknown>>();

    if (!row) {
      return null;
    }

    let roleString: string | undefined;
    if (typeof row === 'object' && row !== null) {
      if ('role' in row && typeof (row as { role?: unknown }).role === 'string') {
        roleString = (row as { role: string }).role;
      }
    }

    return {
      role: normalizeWorkspaceRole(roleString),
    };
  } catch (error) {
    logger.warn('[security] workspace_membership_lookup_error', {
      workspaceId,
      userId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

/**
 * Resolves all workspace IDs accessible to a user.
 * Returns array of workspace/organization IDs, ordered by creation date ascending.
 * Falls back to owned organizations if no explicit org_members rows exist.
 */
export async function getUserWorkspaceIds(
  userId: string | null | undefined,
  db?: D1Client | D1Database | null
): Promise<string[]> {
  if (!userId) return [];
  try {
    const client = resolveClient(db ?? undefined);
    if (typeof client.prepare === 'function') {
      const res = await client
        .prepare('SELECT org_id FROM org_members WHERE user_id = ? ORDER BY created_at ASC')
        .bind(userId)
        .all<{ org_id: string }>();
      const ids = (res?.results ?? []).map((r) => r.org_id).filter(Boolean);
      if (ids.length > 0) return ids;
    } else if (typeof (client as unknown as { from?: unknown }).from === 'function') {
      const res = await (client as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: unknown) => Promise<{ data?: Array<{ org_id?: string }> }> } } })
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId);
      const rows = res?.data ?? [];
      const ids = (Array.isArray(rows) ? rows : [rows]).map((r) => r?.org_id).filter((id): id is string => Boolean(id));
      if (ids.length > 0) return ids;
    }

    if (typeof client.prepare === 'function') {
      const orgRes = await client
        .prepare('SELECT id FROM organizations WHERE user_id = ?')
        .bind(userId)
        .all<{ id: string }>();
      const orgIds = (orgRes?.results ?? []).map((r) => r.id).filter(Boolean);
      if (orgIds.length > 0) return orgIds;
    }
    return [];
  } catch (err) {
    logger.warn('[security] get_user_workspaces_error', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
