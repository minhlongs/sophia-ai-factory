import { createAuthClient, createServerClient } from "./client";
import type { User } from "@supabase/supabase-js";

/**
 * Get current user from request cookies
 */
export async function getCurrentUser(
  cookies: string
): Promise<User | null> {
  try {
    const cookieMap = new URLSearchParams(cookies.replace(/; /g, "&"));
    const accessToken = cookieMap.get("sb-token");

    if (!accessToken) return null;

    const supabase = createAuthClient(accessToken);
    const { data, error } = await db.auth.getUser(accessToken);

    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Sign up a new user
 */
export async function signUp(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabase = createAuthClient();
    const { data, error } = await db.auth.signUp({
      email,
      password,
    });

    if (error) return { user: null, error: error.message };
    return { user: data.user, error: null };
  } catch (e) {
    return { user: null, error: (e as Error).message };
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabase = createAuthClient();
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { user: null, error: error.message };
    return { user: data.user, error: null };
  } catch (e) {
    return { user: null, error: (e as Error).message };
  }
}

/**
 * Send magic link for passwordless login
 */
export async function sendMagicLink(
  email: string
): Promise<{ error: string | null }> {
  try {
    const supabase = createAuthClient();
    const { error } = await db.auth.signInWithOtp({ email });

    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Sign out user
 */
export async function signOut(
  accessToken: string
): Promise<{ error: string | null }> {
  try {
    const supabase = createAuthClient(accessToken);
    const { error } = await db.auth.signOut();

    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Create organization for user
 */
export async function createOrganization(
  userId: string,
  name: string,
  slug: string
): Promise<{ orgId: string | null; error: string | null }> {
  try {
    const db = createServerClient();

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name, slug })
      .select("id")
      .single();

    if (orgError) return { orgId: null, error: orgError.message };

    // Add user as org owner
    const { error: memberError } = await supabase
      .from("org_members")
      .insert({
        org_id: (org as any).id,
        user_id: userId,
        role: "owner",
      });

    if (memberError) return { orgId: null, error: memberError.message };

    return { orgId: (org as any).id, error: null };
  } catch (e) {
    return { orgId: null, error: (e as Error).message };
  }
}

/**
 * Get user's organization
 */
export async function getUserOrganization(
  userId: string
): Promise<{ id: string; name: string; slug: string; role: string } | null> {
  try {
    const supabase = createAuthClient();
    const { data, error } = await supabase
      .from("org_members")
      .select("organizations (id, name, slug), role")
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;

    return {
      id: (data as any).organizations.id,
      name: (data as any).organizations.name,
      slug: (data as any).organizations.slug,
      role: data.role,
    };
  } catch {
    return null;
  }
}
