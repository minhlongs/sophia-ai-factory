/**
 * Admin License API Middleware
 * Shared authentication check for admin license endpoints
 */

import { NextResponse } from 'next/server'

/**
 * Validate admin Basic Auth from request headers
 * Returns true if authorized, false otherwise
 */
export function isAdminAuthorized(request: Request): boolean {
  const basicAuth = request.headers.get('authorization')
  if (!basicAuth) return false

  try {
    const authValue = basicAuth.split(' ')[1]
    const [user, pwd] = atob(authValue).split(':')
    const validUser = process.env.ADMIN_USER
    const validPass = process.env.ADMIN_PASS

    if (!validUser || !validPass) return false
    return user === validUser && pwd === validPass
  } catch {
    return false
  }
}

/**
 * Check admin authorization and return error response if unauthorized
 */
export function checkAdminAuth(request: Request): NextResponse | null {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - Admin credentials required' },
      { status: 401 }
    )
  }
  return null
}
