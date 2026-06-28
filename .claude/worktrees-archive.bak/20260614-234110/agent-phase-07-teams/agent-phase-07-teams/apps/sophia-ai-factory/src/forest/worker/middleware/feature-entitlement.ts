/**
 * Feature Entitlement Service for Cloudflare Worker
 * @module worker/middleware/feature-entitlement
 */

export type { EndpointFeatureMap } from './feature-entitlement-maps'
export { ENDPOINT_FEATURE_MAP, TIER_DEFAULT_FEATURES } from './feature-entitlement-maps'
export { getRequiredFeature, validateFeatureAccess, getDefaultFeaturesForTier, isTierEligibleForOverage, mergeFeatureEntitlements } from './feature-entitlement-logic'
export { getFeatureMetadata } from './feature-entitlement-metadata'
