/**
 * Organization utilities
 *
 * Helper functions for organization operations
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get the organization ID for a user
 * Returns the first org the user belongs to
 */
export async function getOrgId(
  userId: string,
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from("organization_members")
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
  supabase: SupabaseClient
) {
  const { data } = await supabase
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
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase
    .from("organization_members")
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
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .single();

  return data?.role === "admin";
}
