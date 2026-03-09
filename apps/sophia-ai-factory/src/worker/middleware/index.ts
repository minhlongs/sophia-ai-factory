/**
 * RaaS Worker Middleware exports
 * Central authentication and feature access control for Cloudflare Worker
 *
 * @module worker/middleware
 */

export {
  // Main middleware
  raasAuthMiddleware,
  validateLicense,
  checkFeatureAccess,
  createFeatureGuard,
  // Utilities
  extractApiKey,
  extractJwt,
  // Types
  type AuthContext,
  type FeatureCheckResult,
} from './raas-auth-middleware';

export {
  // Feature entitlement
  getRequiredFeature,
  validateFeatureAccess,
  getDefaultFeaturesForTier,
  isTierEligibleForOverage,
  mergeFeatureEntitlements,
  getFeatureMetadata,
  // Constants
  ENDPOINT_FEATURE_MAP,
  TIER_DEFAULT_FEATURES,
  // Types
  type EndpointFeatureMap,
} from './feature-entitlement';

export {
  // Subscription status
  getSubscriptionStatus,
  cacheSubscriptionStatus,
  invalidateSubscriptionCache,
  getSubscriptionStatusWithFallback,
  checkSubscriptionAccess,
  getFeaturesFromSubscription,
  isSubscriptionActive,
  mapPolarTierToRaaSTier,
  getDaysUntilRenewal,
  isSubscriptionExpiringSoon,
  // Types
  type PolarSubscription,
} from './polar-subscription';
