import { createServerClient } from '@/seed/db/client';

export interface OrgMembership {
  orgId: string;
}

export type OrgCheckResult =
  | { authorized: true; orgId: string }
  | { authorized: false; error: string };

/**
 * Validate that the authenticated user belongs to an organization.
 * Returns the orgId on success, or an error result on failure.
 *
 * Pattern: campaigns.ts:44-53
 */
export async function requireOrgMembership(userId: string): Promise<OrgCheckResult> {
  const db = createServerClient();
  const { data: membership } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    return {
      authorized: false,
      error: 'Forbidden: user is not a member of any organization',
    };
  }

  return {
    authorized: true,
    orgId: membership.org_id as string,
  };
}
