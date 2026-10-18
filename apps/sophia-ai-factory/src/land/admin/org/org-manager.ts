'use server';

/**
 * org-manager.ts — Land Layer
 * Organization lifecycle coordinator (listing, detail, creation)
 */

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { OrgRow, OrgDetail } from './types';
import { requireMaster } from './role-guard';
import {
  insertOrgWithOwner,
  queryAllOrgs,
  queryOrgDetailById,
} from './org-manager-queries';

/**
 * List all organizations with member counts.
 */
export async function listOrgs(): Promise<
  Result<OrgRow[], { code: string; message: string }>
> {
  try {
    const auth = await requireMaster();
    if (!auth.ok) return auth;

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    const orgs = await queryAllOrgs(db);
    return success(orgs);
  } catch (err) {
    const error = toError(err);
    logger.error('[OrgManager] listOrgs failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * Get full org details including members.
 */
export async function getOrgDetail(
  orgId: string,
): Promise<Result<OrgDetail, { code: string; message: string }>> {
  try {
    const auth = await requireMaster();
    if (!auth.ok) return auth;

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    const detail = await queryOrgDetailById(db, orgId);
    if (!detail) {
      return failure({ code: 'NOT_FOUND', message: 'Organization not found' });
    }

    return success(detail);
  } catch (err) {
    const error = toError(err);
    logger.error('[OrgManager] getOrgDetail failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * Create a new organization and add the calling user as owner.
 */
export async function createOrg(
  name: string,
  description?: string,
): Promise<Result<{ orgId: string }, { code: string; message: string }>> {
  try {
    const auth = await requireMaster();
    if (!auth.ok) return auth;

    const trimmed = name.trim();
    if (!trimmed) {
      return failure({ code: 'VALIDATION', message: 'Organization name is required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    const orgId = await insertOrgWithOwner(db, trimmed, auth.value.userId, description);
    logger.info('[OrgManager] Created org', { orgId, name: trimmed, by: auth.value.userId });
    return success({ orgId });
  } catch (err) {
    const error = toError(err);
    logger.error('[OrgManager] createOrg failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
