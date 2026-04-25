/**
 * Types and constants for RaaS Authentication Middleware
 * @module worker/middleware/raas-auth-middleware-types
 */

/// <reference types="@cloudflare/workers-types" />

export interface AuthContext {
  userId: string
  licenseNonce: string
  tier: string
  featureEntitlements: string[]
  agencyId?: string
  polarSubscriptionStatus?: string
  isPaid?: boolean
}

export interface FeatureCheckResult {
  allowed: boolean
  reason?: 'not_entitled' | 'license_inactive' | 'subscription_expired'
  featureKey: string
}

export const API_KEY_HEADER = 'x-api-key'
export const BEARER_PREFIX = 'Bearer '

export const CACHE_CONFIG = {
  licenseTtlSeconds: 300,
  subscriptionTtlSeconds: 600,
  entitlementsTtlSeconds: 900,
}
