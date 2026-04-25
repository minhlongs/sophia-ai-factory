/**
 * RaaS Authentication Middleware for Cloudflare Worker
 * @module worker/middleware/raas-auth-middleware
 */

/// <reference types="@cloudflare/workers-types" />

import { validateLicense, checkFeatureAccess } from './raas-auth-middleware-validators'
import type { AuthContext } from './raas-auth-middleware-types'

function buildAuthResponse(statusCode: number, error: string, featureKey?: string): Response {
  return new Response(JSON.stringify({
    error,
    ...(featureKey && { feature: featureKey }),
    timestamp: new Date().toISOString(),
  }), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
    },
  })
}

export async function raasAuthMiddleware(request: Request, env: Env, ctx: ExecutionContext): Promise<Response | null> {
  if (request.method === 'OPTIONS') return null

  const validationResult = await validateLicense(request, env)
  if (!validationResult.valid) return buildAuthResponse(401, validationResult.error || 'Unauthorized')

  const authenticatedRequest = new Request(request)
  authenticatedRequest.headers.set('X-Auth-Context', encodeURIComponent(JSON.stringify(validationResult.context)));
  (env as Record<string, unknown>).__authContext = validationResult.context

  return null
}

export function createFeatureGuard(featureKey: string) {
  return async function featureGuardMiddleware(request: Request, env: Env, ctx: ExecutionContext): Promise<Response | null> {
    const authResponse = await raasAuthMiddleware(request, env, ctx)
    if (authResponse) return authResponse

    const authContext = (env as Record<string, unknown>).__authContext as AuthContext | undefined
    if (!authContext) return buildAuthResponse(500, 'Authentication context missing')

    const featureResult = await checkFeatureAccess(featureKey, authContext)
    if (!featureResult.allowed) return buildAuthResponse(403, `Feature access denied: ${featureResult.reason}`, featureKey)

    return null
  }
}

export type { AuthContext, FeatureCheckResult } from './raas-auth-middleware-types'
export { extractApiKey, extractJwt } from './raas-auth-middleware-kv'
export { validateLicense, checkFeatureAccess } from './raas-auth-middleware-validators'
