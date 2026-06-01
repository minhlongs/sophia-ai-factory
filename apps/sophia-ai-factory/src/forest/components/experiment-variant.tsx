/**
 * Server component: reads A/B variant for a given experiment and renders children
 * with data-variant attribute. Cookie-first (fast path), KV fallback.
 */

import { cookies } from 'next/headers'
import { assignVariant, readVariantFromCookie } from '@/land/signals/ab-experiment'

interface ExperimentVariantProps {
  /** PostHog experiment / feature flag name */
  experimentName: string
  /** Distinct ID for the current user (from session) */
  distinctId: string
  children: React.ReactNode
  /** Optional: render nothing if control */
  hideControl?: boolean
}

export async function ExperimentVariant({
  experimentName,
  distinctId,
  children,
  hideControl = false,
}: ExperimentVariantProps) {
  const cookieStore = await cookies()
  const cookieMap: Record<string, string> = {}
  for (const [name, cookie] of cookieStore) {
    cookieMap[name] = typeof cookie === 'string' ? cookie : cookie.value
  }

  // Fast path: read from existing cookie
  let variant = readVariantFromCookie(cookieMap, experimentName)

  // Slow path: fetch from PostHog via KV cache
  if (!variant) {
    const result = await assignVariant(experimentName, distinctId)
    variant = result.variant
    // Note: Set-Cookie must be set on the Response in a Route Handler.
    // In Server Components we can only read cookies, not write them here.
    // The cookie will be set on next request via the /api/signals/experiments route.
  }

  if (hideControl && variant === 'control') {
    return null
  }

  return (
    <div data-experiment={experimentName} data-variant={variant}>
      {children}
    </div>
  )
}
