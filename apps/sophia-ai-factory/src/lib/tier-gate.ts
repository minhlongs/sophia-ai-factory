import { Tier, FeatureFlag } from "@/types";
import { checkTierAccess } from "@/lib/features";

/**
 * Error class for authorization failures
 */
export class AuthorizationError extends Error {
  public requiredTier?: Tier;

  constructor(message: string, requiredTier?: Tier) {
    super(message);
    this.name = "AuthorizationError";
    this.requiredTier = requiredTier;
  }
}

/**
 * Verify if a user tier has access to a specific feature
 * Throws AuthorizationError if access is denied
 * Useful for server-side checks where you want to fail fast
 *
 * @param userTier The user's subscription tier
 * @param feature The feature flag to check
 * @throws AuthorizationError
 */
export function verifyTierAccess(userTier: Tier, feature: FeatureFlag): void {
  const result = checkTierAccess(userTier, feature);

  if (!result.hasAccess) {
    throw new AuthorizationError(
      result.reason || "Access denied",
      result.requiredTier
    );
  }
}

/**
 * Higher-order function wrapper to gate a function execution
 *
 * @param fn The function to execute if authorized
 * @param userTier The user's subscription tier
 * @param feature The feature flag to check
 */
export function withTierGate<T>(
  fn: () => T,
  userTier: Tier,
  feature: FeatureFlag
): T {
  verifyTierAccess(userTier, feature);
  return fn();
}

/**
 * Async version of withTierGate
 */
export async function withTierGateAsync<T>(
  fn: () => Promise<T>,
  userTier: Tier,
  feature: FeatureFlag
): Promise<T> {
  verifyTierAccess(userTier, feature);
  return await fn();
}
