import { User, Tier } from "@/types";

/**
 * Mock authentication utilities
 * In production, this would integrate with NextAuth, Clerk, or similar
 */

/**
 * Mock user for development - simulates different tiers
 * Can be controlled via environment variable or cookie
 */
export function getCurrentUser(): User {
  // Check environment variable for tier override
  const envTier = process.env.NEXT_PUBLIC_MOCK_TIER as Tier | undefined;

  // Default to ENTERPRISE for development
  const tier: Tier = envTier || "ENTERPRISE";

  return {
    id: "mock-user-001",
    email: "demo@sophia.ai",
    tier,
    createdAt: new Date(),
  };
}

/**
 * Get current user's tier
 */
export function getCurrentTier(): Tier {
  return getCurrentUser().tier;
}

/**
 * Check if current user has specific tier
 */
export function hasMinimumTier(requiredTier: Tier): boolean {
  const currentTier = getCurrentTier();
  const tierOrder: Tier[] = ["BASIC", "PREMIUM", "ENTERPRISE"];

  const currentIndex = tierOrder.indexOf(currentTier);
  const requiredIndex = tierOrder.indexOf(requiredTier);

  return currentIndex >= requiredIndex;
}

/**
 * Simulate tier upgrade (for demo purposes)
 * In production, this would handle payment and database updates
 */
export function mockUpgradeTier(newTier: Tier): void {
  console.log(`[Mock] Upgrading to ${newTier} tier`);
  // In production: update database, process payment, send confirmation email
}
