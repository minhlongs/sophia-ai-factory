import { createClient } from "@/lib/supabase/server";
import type { User, Tier } from "@/types";

/**
 * Get the currently authenticated user from Supabase Auth.
 * Returns null if no user is signed in.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const tier = (user.user_metadata?.tier as Tier) || "BASIC";

  return {
    id: user.id,
    email: user.email!,
    tier,
    createdAt: new Date(user.created_at),
  };
}

/**
 * Extract tier from a user object (or default to BASIC).
 */
export function getCurrentTier(user: User | null): Tier {
  return user?.tier || "BASIC";
}

/**
 * Check if a user's tier meets the minimum required tier.
 */
export function hasMinimumTier(userTier: Tier, requiredTier: Tier): boolean {
  const tierOrder: Tier[] = ["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"];
  return tierOrder.indexOf(userTier) >= tierOrder.indexOf(requiredTier);
}
