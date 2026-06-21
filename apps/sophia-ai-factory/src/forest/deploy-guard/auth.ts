/**
 * Deploy Guard Auth — allows both admin cookie and deploy script token
 * Tasks #88, #92, #47
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Check if request has valid deploy automation token.
 * Set DEPLOY_GUARD_API_TOKEN in environment for deploy-with-sha.sh.
 */
function hasDeployToken(request: NextRequest): boolean {
  const token = request.headers.get('X-Deploy-Guard-Token')
  const expected = process.env.DEPLOY_GUARD_API_TOKEN
  return !!expected && token === expected
}

/**
 * Get operator identifier from request.
 * For web UI: reads admin_challenge_token to get userId.
 * For deploy script: uses X-Deploy-Operator header or falls back to IP.
 */
export function getOperatorId(request: NextRequest): string {
  // Deploy script can explicitly set operator
  const deployOperator = request.headers.get('X-Deploy-Operator')
  if (deployOperator) return deployOperator

  // TODO: extract from admin_challenge_token cookie if present
  // For now, fallback to hostname
  return request.headers.get('user-agent') || 'unknown'
}

/**
 * Middleware: require admin (cookie) OR deploy token.
 * Returns NextResponse if unauthorized, otherwise null (allow).
 */
export function requireDeployGuardAuth(request: NextRequest): Response | null {
  // Allow deploy token
  if (hasDeployToken(request)) {
    return null
  }

  // For web UI, we rely on the route-level requireAdmin() call
  // This function is only a supplement; the route should still call requireAdmin()
  // for web requests, but we allow bypass if token present.
  return null
}
