/**
 * RaaS Authentication Middleware for Cloudflare Worker
 * Validates mk_ API keys and JWT tokens against RaaS Gateway
 * Enforces feature-level access control based on Polar subscription
 *
 * @module worker/middleware/raas-auth-middleware
 */

import { jwtVerify } from 'jose';
import { validateApiKey } from '../../lib/security/api-key-validator';
import { validateJwt, extractEnrichedClaims } from '../../lib/security/jwt-validator';
import type { EnrichedJwtPayload } from '../../lib/auth/enriched-jwt';

// Cloudflare Worker types
/// <reference types="@cloudflare/workers-types" />

/**
 * Authentication context after successful validation
 */
export interface AuthContext {
  userId: string;
  licenseNonce: string;
  tier: string;
  featureEntitlements: string[];
  agencyId?: string;
  polarSubscriptionStatus?: string;
  isPaid?: boolean;
}

/**
 * Feature check result for access control
 */
export interface FeatureCheckResult {
  allowed: boolean;
  reason?: 'not_entitled' | 'license_inactive' | 'subscription_expired';
  featureKey: string;
}

/**
 * API Key header format: X-API-Key: mk_{keyId}_{signature}
 */
const API_KEY_HEADER = 'x-api-key';

/**
 * JWT header format: Authorization: Bearer <token>
 */
const BEARER_PREFIX = 'Bearer ';

/**
 * Cache configuration for KV
 */
const CACHE_CONFIG = {
  licenseTtlSeconds: 300,    // 5 minutes for license validation
  subscriptionTtlSeconds: 600, // 10 minutes for subscription status
  entitlementsTtlSeconds: 900, // 15 minutes for feature entitlements
};

/**
 * Extract API key from request headers
 *
 * @param request - Incoming request
 * @returns API key or null if not present
 */
export function extractApiKey(request: Request): string | null {
  return request.headers.get(API_KEY_HEADER);
}

/**
 * Extract JWT from request headers
 *
 * @param request - Incoming request
 * @returns JWT token or null if not present
 */
export function extractJwt(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    return null;
  }
  return authHeader.slice(BEARER_PREFIX.length);
}

/**
 * Get license context from KV cache or database
 *
 * @param licenseNonce - License identifier
 * @param kv - Cloudflare KV namespace
 * @returns License context or null
 */
async function getLicenseContext(
  licenseNonce: string,
  kv: KVNamespace
): Promise<{
  tier: string;
  agencyId?: string;
  polarCustomerId?: string;
  featureEntitlements: string[];
} | null> {
  try {
    // Check KV cache first
    const cacheKey = `license:${licenseNonce}`;
    const cached = await kv.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database query via HTTP (in production, this would be a internal API call)
    // For now, return null to indicate cache miss
    return null;
  } catch (error) {
    console.error('[RaaS Auth Middleware] Failed to fetch license context', error);
    return null;
  }
}

/**
 * Get Polar subscription status from KV cache
 *
 * @param polarCustomerId - Polar customer identifier
 * @param kv - Cloudflare KV namespace
 * @returns Subscription status or null
 */
async function getSubscriptionStatus(
  polarCustomerId: string,
  kv: KVNamespace
): Promise<{
  status: 'active' | 'inactive' | 'past_due' | 'canceled';
  tier: 'starter' | 'growth' | 'premium' | 'master';
  features: string[];
} | null> {
  try {
    const cacheKey = `polar:subscription:${polarCustomerId}`;
    const cached = await kv.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  } catch (error) {
    console.error('[RaaS Auth Middleware] Failed to fetch subscription status', error);
    return null;
  }
}

/**
 * Validate license and return auth context
 *
 * Supports two authentication methods:
 * 1. mk_ API key (RaaS Gateway API keys)
 * 2. JWT token (enriched with license claims)
 *
 * @param request - Incoming request
 * @param env - Cloudflare Worker environment
 * @returns Validation result with auth context if successful
 */
export async function validateLicense(
  request: Request,
  env: Env
): Promise<{ valid: boolean; context?: AuthContext; error?: string }> {
  const apiKey = extractApiKey(request);
  const jwtToken = extractJwt(request);

  // No authentication provided
  if (!apiKey && !jwtToken) {
    return {
      valid: false,
      error: 'Authentication required: provide X-API-Key or Authorization header',
    };
  }

  // API Key authentication path
  if (apiKey) {
    try {
      const result = await validateApiKey(apiKey);

      if (!result.valid) {
        return {
          valid: false,
          error: `Invalid API key: ${result.error}`,
        };
      }

      // Fetch license context from KV
      const licenseContext = await getLicenseContext(result.apiKey!.ownerId, env.KV_KV);

      if (!licenseContext) {
        return {
          valid: false,
          error: 'License not found',
        };
      }

      return {
        valid: true,
        context: {
          userId: result.apiKey!.ownerId,
          licenseNonce: result.apiKey!.ownerId,
          tier: licenseContext.tier,
          featureEntitlements: licenseContext.featureEntitlements,
          agencyId: licenseContext.agencyId,
        },
      };
    } catch (error) {
      console.error('[RaaS Auth Middleware] API key validation failed', error);
      return {
        valid: false,
        error: 'API key validation failed',
      };
    }
  }

  // JWT authentication path
  if (jwtToken) {
    try {
      const result = await validateJwt(jwtToken);

      if (!result.valid) {
        return {
          valid: false,
          error: `Invalid JWT: ${result.error}`,
        };
      }

      // Extract enriched claims
      const enrichedClaims = extractEnrichedClaims(result.payload!);

      if (!enrichedClaims) {
        return {
          valid: false,
          error: 'JWT missing enriched claims',
        };
      }

      return {
        valid: true,
        context: {
          userId: enrichedClaims.sub,
          licenseNonce: enrichedClaims.license_nonce,
          tier: enrichedClaims.license_tier,
          featureEntitlements: enrichedClaims.feature_entitlements,
          agencyId: enrichedClaims.agency_id,
          polarSubscriptionStatus: enrichedClaims.polar_subscription_id,
          isPaid: enrichedClaims.is_paid,
        },
      };
    } catch (error) {
      console.error('[RaaS Auth Middleware] JWT validation failed', error);
      return {
        valid: false,
        error: 'JWT validation failed',
      };
    }
  }

  return {
    valid: false,
    error: 'No valid authentication method',
  };
}

/**
 * Check if feature is entitled for user
 *
 * @param featureKey - Feature identifier (e.g., 'heygen.createVideo')
 * @param authContext - Authenticated user context
 * @returns Feature check result
 */
export async function checkFeatureAccess(
  featureKey: string,
  authContext: AuthContext
): Promise<FeatureCheckResult> {
  // Check if feature is in entitlements
  const hasEntitlement = authContext.featureEntitlements.includes(featureKey);

  if (!hasEntitlement) {
    return {
      allowed: false,
      reason: 'not_entitled',
      featureKey,
    };
  }

  // Check subscription status if available
  if (authContext.polarSubscriptionStatus === 'canceled' ||
      authContext.polarSubscriptionStatus === 'inactive') {
    return {
      allowed: false,
      reason: 'subscription_expired',
      featureKey,
    };
  }

  return {
    allowed: true,
    featureKey,
  };
}

/**
 * Build standardized 401/403 error response
 *
 * @param statusCode - HTTP status code (401 or 403)
 * @param error - Error details
 * @param featureKey - Optional feature key for 403 responses
 * @returns Response object
 */
function buildAuthResponse(
  statusCode: number,
  error: string,
  featureKey?: string
): Response {
  const body = {
    error,
    ...(featureKey && { feature: featureKey }),
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
    },
  });
}

/**
 * RaaS Authentication Middleware main entry point
 *
 * Intercepts requests and validates authentication before allowing access.
 * Returns null if request should continue to handler.
 *
 * @param request - Incoming request
 * @param env - Cloudflare Worker environment
 * @param ctx - ExecutionContext
 * @returns Response if blocked, null if allowed to proceed
 */
export async function raasAuthMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  // Skip auth for OPTIONS preflight requests
  if (request.method === 'OPTIONS') {
    return null;
  }

  // Validate license
  const validationResult = await validateLicense(request, env);

  if (!validationResult.valid) {
    return buildAuthResponse(401, validationResult.error || 'Unauthorized');
  }

  // Attach auth context to request headers for downstream handlers
  // This allows API routes to access validated user info
  const authenticatedRequest = new Request(request);
  authenticatedRequest.headers.set(
    'X-Auth-Context',
    encodeURIComponent(JSON.stringify(validationResult.context))
  );

  // Store context in env for downstream access (optional)
  (env as any).__authContext = validationResult.context;

  return null;
}

/**
 * Create feature-gated middleware wrapper
 *
 * @param featureKey - Required feature for access
 * @returns Middleware function that checks both auth and feature access
 */
export function createFeatureGuard(featureKey: string) {
  return async function featureGuardMiddleware(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response | null> {
    // First validate authentication
    const authResponse = await raasAuthMiddleware(request, env, ctx);
    if (authResponse) {
      return authResponse;
    }

    // Get auth context
    const authContext = (env as any).__authContext as AuthContext | undefined;
    if (!authContext) {
      return buildAuthResponse(500, 'Authentication context missing');
    }

    // Check feature access
    const featureResult = await checkFeatureAccess(featureKey, authContext);

    if (!featureResult.allowed) {
      return buildAuthResponse(
        403,
        `Feature access denied: ${featureResult.reason}`,
        featureKey
      );
    }

    return null;
  };
}
