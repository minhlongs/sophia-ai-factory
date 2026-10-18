'use client'

/**
 * Low-level GA4 gtag, PostHog capture, and UTM attachment helpers.
 * @module land/analytics/conversion-event-dispatchers
 */

import { getUtmParams } from '@/seed/utils/utm-capture'

/** GA4 gtag function type — subset we use */
type GtagFn = (command: string, action: string, params?: Record<string, unknown>) => void

/** Retrieve gtag from window if loaded, else no-op */
export function gtag(...args: Parameters<GtagFn>): void {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { gtag?: GtagFn }
  if (typeof w.gtag === 'function') {
    w.gtag(...args)
  }
}

/** PostHog capture helper — safe no-op if posthog not loaded */
export function phCapture(event: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const w = window as typeof window & {
    posthog?: { capture?: (e: string, p?: Record<string, unknown>) => void }
  }
  if (typeof w.posthog?.capture === 'function') {
    w.posthog.capture(event, props)
  }
}

/** Attach UTM params to an event payload. */
export function withUtm(props: Record<string, unknown>): Record<string, unknown> {
  const utm = getUtmParams()
  return { ...props, ...utm }
}
