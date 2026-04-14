/**
 * JWT Claims Enrichment Service
 *
 * Issues JWTs with embedded license metadata for fast Cloudflare Worker enforcement.
 * Contains tier, quota, Polar customer ID, dunning state, and feature entitlements.
 *
 * @module auth/enriched-jwt
 */

import { SignJWT, jwtVerify } from 'jose';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { getEffectiveQuotaLimits } from '@/lib/quota/quota-checker';
import type { QuotaLimit } from '@/lib/usage-metering/types';
import { getAccessibleFeatures } from '@/lib/features';

/**
 * Feature entitlement limits per feature
 */
export interface FeatureLimit {
  daily_limit?: number;
  monthly_limit?: number;
  max_tokens?: number;
}

/**
 * Enriched JWT payload with license context and feature entitlements
 * Aligned with EnrichedJwtClaims from Phase 2 requirements
 */
export interface EnrichedJwtPayload {
  // Standard claims
  sub: string;           // user_id
  iat: number;           // issued at (seconds)
  exp: number;           // expiration (seconds)
  jti?: string;          // JWT ID (for replay prevention)

  // RaaS License claims
  license_nonce: string;
  license_tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  license_issued_at: number;
  license_expires_at?: number;

  // Quota claims (cached at issuance)
  quota: QuotaLimit;

  // Tenant isolation
  agency_id?: string;

  // Polar billing context (Phase 3)
  polar_customer_id?: string;
  polar_subscription_id?: string;
  polar_subscription_status?: 'active' | 'inactive' | 'past_due' | 'canceled';
  billing_status?: 'active' | 'past_due' | 'suspended';
  is_paid?: boolean;
  overage_allowed?: boolean;

  // Dunning state (cached)
  dunning_state?: 'ok' | 'grace_period' | 'suspended' | 'delinquent';

  // Feature entitlements
  feature_entitlements: string[];  // ['heygen.createVideo', 'elevenlabs.synthesize', ...]
  feature_limits: Record<string, FeatureLimit>;

  // Feature permissions (optional, legacy)
  permissions?: string[];
}

/**
 * Alias for EnrichedJwtClaims to match Phase 2 spec
 */
export type EnrichedJwtClaims = EnrichedJwtPayload;

/**
 * License context fetched from database
 */
export interface LicenseContext {
  tier: string;
  agencyId?: string;
  polarCustomerId?: string;
  polarSubscriptionId?: string;
  polarStatus?: string;
  expiresAt?: number;
  createdAt: number;
}

/**
 * Get default feature entitlements based on tier
 * Maps tier to feature keys for granular access control
 */
export function getDefaultEntitlements(tier: string): string[] {
  // Map legacy subscription tiers to RaaS tiers
  const tierMap: Record<string, 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'> = {
    'free': 'BASIC',
    'basic': 'BASIC',
    'pro': 'PREMIUM',
    'premium': 'PREMIUM',
    'enterprise': 'ENTERPRISE',
    'master': 'MASTER',
  };

  const mappedTier = tierMap[tier.toLowerCase()] || 'BASIC';

  // Get features from existing features.ts system
  const features = getAccessibleFeatures(mappedTier);

  // Convert feature flags to feature keys
  const featureKeys: string[] = [];

  // Core feature entitlements by tier
  featureKeys.push('heygen.createVideo');
  featureKeys.push('heygen.getVideoStatus');
  featureKeys.push('elevenlabs.synthesize');
  featureKeys.push('elevenlabs.getAudioStatus');
  featureKeys.push('openrouter.chat');
  featureKeys.push('openrouter.complete');

  if (mappedTier === 'PREMIUM' || mappedTier === 'ENTERPRISE' || mappedTier === 'MASTER') {
    featureKeys.push('affiliate.engine');
    featureKeys.push('roi.calculator');
    featureKeys.push('analytics.basic');
  }

  if (mappedTier === 'ENTERPRISE' || mappedTier === 'MASTER') {
    featureKeys.push('api.integrations');
    featureKeys.push('auto.update');
    featureKeys.push('admin.dashboard');
    featureKeys.push('analytics.advanced');
  }

  if (mappedTier === 'MASTER') {
    featureKeys.push('white.label');
    featureKeys.push('custom.branding');
    featureKeys.push('priority.support');
  }

  return [...featureKeys, ...features.map(f => f.replace('enable_', ''))];
}

/**
 * Get feature limits based on tier
 */
function getFeatureLimits(tier: string): Record<string, FeatureLimit> {
  const limits: Record<string, FeatureLimit> = {};

  // Base limits for all tiers
  limits['heygen.createVideo'] = { daily_limit: 10, monthly_limit: 100, max_tokens: 5000 };
  limits['elevenlabs.synthesize'] = { daily_limit: 20, monthly_limit: 200, max_tokens: 10000 };
  limits['openrouter.chat'] = { daily_limit: 100, monthly_limit: 1000, max_tokens: 50000 };

  // Premium+ limits
  if (['PREMIUM', 'ENTERPRISE', 'MASTER'].includes(tier.toUpperCase())) {
    limits['heygen.createVideo'] = { daily_limit: 50, monthly_limit: 500, max_tokens: 10000 };
    limits['elevenlabs.synthesize'] = { daily_limit: 100, monthly_limit: 1000, max_tokens: 25000 };
    limits['openrouter.chat'] = { daily_limit: 500, monthly_limit: 5000, max_tokens: 100000 };
  }

  // Enterprise+ limits
  if (['ENTERPRISE', 'MASTER'].includes(tier.toUpperCase())) {
    limits['heygen.createVideo'] = { daily_limit: 200, monthly_limit: 2000, max_tokens: 25000 };
    limits['elevenlabs.synthesize'] = { daily_limit: 500, monthly_limit: 5000, max_tokens: 100000 };
    limits['openrouter.chat'] = { daily_limit: 2000, monthly_limit: 20000, max_tokens: 500000 };
  }

  // Master unlimited
  if (tier.toUpperCase() === 'MASTER') {
    limits['heygen.createVideo'] = { monthly_limit: 10000 };
    limits['elevenlabs.synthesize'] = { monthly_limit: 20000 };
    limits['openrouter.chat'] = { monthly_limit: 100000 };
  }

  return limits;
}

/**
 * Fetch Polar billing status for license
 */
async function fetchPolarBillingStatus(
  polarCustomerId?: string
): Promise<{
  billingStatus?: 'active' | 'past_due' | 'suspended';
  isPaid?: boolean;
  overageAllowed?: boolean;
} | null> {
  if (!polarCustomerId) {
    return null;
  }

  try {
    const db = createServerClient();

    // Fetch from user_profiles or billing_events
    const { data } = await db
      .from('user_profiles')
      .select('subscription_status, subscription_tier')
      .eq('polar_customer_id', polarCustomerId)
      .single();

    if (!data) {
      return null;
    }

    const statusMap: Record<string, 'active' | 'past_due' | 'suspended' | undefined> = {
      'active': 'active',
      'past_due': 'past_due',
      'suspended': 'suspended',
      'canceled': 'suspended',
      'inactive': 'suspended',
    };

    const subscriptionStatus = data.subscription_status as string | undefined;
    const subscriptionTier = data.subscription_tier as string | undefined;

    return {
      billingStatus: statusMap[subscriptionStatus || ''] || 'active',
      isPaid: subscriptionStatus === 'active',
      overageAllowed: subscriptionTier === 'enterprise' || subscriptionTier === 'master',
    };
  } catch (error) {
    logger.warn('[Enriched JWT] Failed to fetch Polar billing status', error as Error);
    return null;
  }
}

/**
 * JWT configuration
 */
const JWT_CONFIG = {
  algorithm: 'HS256' as const,
  ttlSeconds: 3600, // 1 hour
};

/**
 * Get JWT secret from environment
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.NEXT_PUBLIC_JWT_SECRET;

  if (!secret) {
    logger.warn('[Enriched JWT] JWT_SECRET not set, using insecure default');
    return new TextEncoder().encode('insecure-dev-secret-change-in-production');
  }

  return new TextEncoder().encode(secret);
}

/**
 * Fetch license metadata for JWT enrichment
 */
export async function getLicenseContext(licenseNonce: string): Promise<LicenseContext | null> {
  try {
    const db = createServerClient();

    const { data, error } = await db
      .from('raas_licenses')
      .select('tier, agency_id, polar_customer_id, polar_subscription_status, expires_at, created_at')
      .eq('license_nonce', licenseNonce)
      .single();

    if (error || !data) {
      logger.error('[Enriched JWT] Failed to fetch license', error as Error);
      return null;
    }

    return {
      tier: data.tier,
      agencyId: data.agency_id || undefined,
      polarCustomerId: data.polar_customer_id || undefined,
      polarStatus: data.polar_subscription_status || undefined,
      expiresAt: data.expires_at ? data.expires_at * 1000 : undefined,
      createdAt: data.created_at,
    };
  } catch (error) {
    logger.error('[Enriched JWT] Error fetching license context', error as Error);
    return null;
  }
}

/**
 * Fetch dunning state for license
 */
async function fetchDunningState(licenseNonce: string): Promise<'ok' | 'grace_period' | 'suspended' | 'delinquent'> {
  try {
    const db = createServerClient();

    const { data } = await db
      .from('dunning_states')
      .select('state')
      .eq('license_nonce', licenseNonce)
      .single();

    return (data?.state as 'ok' | 'grace_period' | 'suspended' | 'delinquent') || 'ok';
  } catch (error) {
    logger.warn('[Enriched JWT] Failed to fetch dunning state', error as Error);
    return 'ok'; // Default to ok on error
  }
}

/**
 * Create enriched JWT with license context and feature entitlements
 *
 * @param userId - User ID (sub claim)
 * @param licenseNonce - License identifier
 * @param ttlSeconds - Token TTL (default: 1 hour)
 * @returns Signed JWT token and payload, or null on error
 */
export async function createEnrichedJwt(
  userId: string,
  licenseNonce: string,
  ttlSeconds: number = JWT_CONFIG.ttlSeconds
): Promise<{ token: string; payload: EnrichedJwtPayload } | null> {
  try {
    // 1. Fetch license context
    const licenseContext = await getLicenseContext(licenseNonce);
    if (!licenseContext) {
      return null;
    }

    // 2. Get effective quota limits
    const quota = await getEffectiveQuotaLimits(licenseNonce, licenseContext.tier);

    // 3. Fetch dunning state
    const dunningState = await fetchDunningState(licenseNonce);

    // 4. Fetch Polar billing status
    const polarBilling = await fetchPolarBillingStatus(licenseContext.polarCustomerId);

    // 5. Get feature entitlements and limits
    const featureEntitlements = getDefaultEntitlements(licenseContext.tier);
    const featureLimits = getFeatureLimits(licenseContext.tier);

    // 6. Generate JWT ID for replay prevention
    const jti = crypto.randomUUID();

    // 7. Build enriched payload with feature entitlements
    const now = Math.floor(Date.now() / 1000);
    const payload: EnrichedJwtPayload = {
      sub: userId,
      iat: now,
      exp: now + ttlSeconds,
      jti,
      license_nonce: licenseNonce,
      license_tier: licenseContext.tier as EnrichedJwtPayload['license_tier'],
      license_issued_at: licenseContext.createdAt,
      license_expires_at: licenseContext.expiresAt,
      quota,
      agency_id: licenseContext.agencyId,
      polar_customer_id: licenseContext.polarCustomerId,
      polar_subscription_id: licenseContext.polarSubscriptionId,
      polar_subscription_status: licenseContext.polarStatus as EnrichedJwtPayload['polar_subscription_status'],
      billing_status: polarBilling?.billingStatus || 'active',
      is_paid: polarBilling?.isPaid || true,
      overage_allowed: polarBilling?.overageAllowed || false,
      dunning_state: dunningState,
      feature_entitlements: featureEntitlements,
      feature_limits: featureLimits,
    };

    // 8. Sign JWT
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: JWT_CONFIG.algorithm })
      .setIssuedAt(now)
      .setExpirationTime(now + ttlSeconds)
      .setJti(jti)
      .sign(getJwtSecret());

    logger.info('[Enriched JWT] Created enriched JWT', {
      userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      tier: licenseContext.tier,
      expiresAt: new Date((now + ttlSeconds) * 1000).toISOString(),
      featureCount: featureEntitlements.length,
    });

    return { token, payload };
  } catch (error) {
    logger.error('[Enriched JWT] Failed to create JWT', error as Error);
    return null;
  }
}

/**
 * Verify enriched JWT
 *
 * @param token - JWT token string
 * @returns Verified payload or null
 */
export async function verifyEnrichedJwt(
  token: string
): Promise<EnrichedJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [JWT_CONFIG.algorithm],
      clockTolerance: 60, // 60 second tolerance
    });

    return payload as EnrichedJwtPayload;
  } catch (error) {
    logger.warn('[Enriched JWT] JWT verification failed', error as Error);
    return null;
  }
}

/**
 * Decode JWT without verification (for debugging)
 */
export function decodeEnrichedJwt(token: string): EnrichedJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payloadStr) as EnrichedJwtPayload;
  } catch {
    return null;
  }
}

/**
 * Extract quota from JWT payload
 */
export function extractQuotaFromJwt(payload: EnrichedJwtPayload): QuotaLimit {
  return payload.quota;
}

/**
 * Check if JWT is expired
 */
export function isJwtExpired(token: string): boolean {
  const payload = decodeEnrichedJwt(token);
  if (!payload) return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * Refresh JWT if expired
 *
 * @param token - Current JWT token
 * @returns New token if expired, otherwise returns the same token
 */
export async function refreshJwtIfExpired(token: string): Promise<string> {
  if (!isJwtExpired(token)) {
    return token;
  }

  const payload = decodeEnrichedJwt(token);
  if (!payload) {
    throw new Error('Invalid JWT token');
  }

  // Create new token with same claims
  const result = await createEnrichedJwt(
    payload.sub,
    payload.license_nonce,
    JWT_CONFIG.ttlSeconds
  );

  if (!result) {
    throw new Error('Failed to refresh JWT');
  }

  return result.token;
}
