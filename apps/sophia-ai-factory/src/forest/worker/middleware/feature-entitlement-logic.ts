/**
 * Feature entitlement business logic
 * @module worker/middleware/feature-entitlement-logic
 */

import { ENDPOINT_FEATURE_MAP, TIER_DEFAULT_FEATURES } from './feature-entitlement-maps'

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`)
}

export function getRequiredFeature(pathname: string): string | null {
  const normalizedPath = pathname.split('?')[0]
  if (ENDPOINT_FEATURE_MAP[normalizedPath]) return ENDPOINT_FEATURE_MAP[normalizedPath]
  for (const [pattern, feature] of Object.entries(ENDPOINT_FEATURE_MAP)) {
    if (pattern.includes('*') && patternToRegExp(pattern).test(normalizedPath)) return feature
  }
  return null
}

export function validateFeatureAccess(featureKey: string, entitlements: string[]): boolean {
  if (!featureKey) return true
  if (!entitlements || entitlements.length === 0) return false
  return entitlements.includes(featureKey)
}

export function getDefaultFeaturesForTier(tier: string): string[] {
  return TIER_DEFAULT_FEATURES[tier.toUpperCase()] || TIER_DEFAULT_FEATURES.BASIC
}

export function isTierEligibleForOverage(tier: string): boolean {
  const t = tier.toUpperCase()
  return t === 'ENTERPRISE' || t === 'MASTER'
}

export function mergeFeatureEntitlements(...featureLists: string[][]): string[] {
  const merged = new Set<string>()
  for (const list of featureLists) for (const feature of list) merged.add(feature)
  return Array.from(merged)
}
