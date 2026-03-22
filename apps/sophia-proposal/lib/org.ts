/**
 * Organization utilities
 *
 * Helper functions for organization operations
 */

import { D1Client } from './db/d1-query-builder';
import type { OrgMember } from './db/types';

/**
 * Get the organization ID for a user
 * Returns the first org the user belongs to
 */
export async function getOrgId(
  userId: string,
  db: D1Client
): Promise<string | null> {
  const { data } = await db
    .from<OrgMember>("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .single();

  return data?.org_id || null;
}

/**
 * Get organization details
 */
export async function getOrg(
  orgId: string,
  db: D1Client
) {
  const { data } = await db
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  return data;
}

/**
 * Check if user is member of organization
 */
export async function isOrgMember(
  userId: string,
  orgId: string,
  db: D1Client
): Promise<boolean> {
  const { data } = await db
    .from<OrgMember>("org_members")
    .select("id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .single();

  return !!data;
}

/**
 * Check if user is org admin
 */
export async function isOrgAdmin(
  userId: string,
  orgId: string,
  db: D1Client
): Promise<boolean> {
  const { data } = await db
    .from<OrgMember>("org_members")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .single();

  return data?.role === "admin";
}
