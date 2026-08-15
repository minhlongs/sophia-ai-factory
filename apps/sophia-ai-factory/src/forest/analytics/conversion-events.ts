'use client'

/**
 * Conversion event tracking helpers.
 *
 * Fires events to:
 * 1. GA4 via window.gtag (if loaded)
 * 2. PostHog via posthog-js (if loaded)
 *
 * All functions are fire-and-forget and safe to call in any browser context.
 * No server-side code — this is a client-only module ('use client').
 *
 * Events:
 *  - signup_complete     — user completes registration
 *  - checkout_started    — user initiates a paid tier checkout
 *  - payment_success     — IPN confirmation received (redirect from NOWPayments)
 *  - tier_upgrade        — user upgrades from one paid tier to another
 *  - checkout_abandoned  — client-side detection (page unload after checkout_started)
 *
 * @module lib/analytics/conversion-events
 */

import { getUtmParams } from '@/land/analytics/utm-capture'

/** GA4 gtag function type — subset we use */
type GtagFn = (command: string, action: string, params?: Record<string, unknown>) => void

/** Retrieve gtag from window if loaded, else no-op */
function gtag(...args: Parameters<GtagFn>): void {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { gtag?: GtagFn }
  if (typeof w.gtag === 'function') {
    w.gtag(...args)
  }
}

/** PostHog capture helper — safe no-op if posthog not loaded */
function phCapture(event: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { posthog?: { capture?: (e: string, p?: Record<string, unknown>) => void } }
  if (typeof w.posthog?.capture === 'function') {
    w.posthog.capture(event, props)
  }
}

/** Attach UTM params to an event payload. */
function withUtm(props: Record<string, unknown>): Record<string, unknown> {
  const utm = getUtmParams()
  return { ...props, ...utm }
}

// ─── Public event functions ──────────────────────────────────────────────────

/**
 * Track completed signup (after Better Auth signUp.email resolves without error).
 */
export function trackSignupComplete(props: { method?: string } = {}): void {
  const payload = withUtm({ method: props.method ?? 'email' })
  gtag('event', 'signup_complete', payload)
  phCapture('signup_complete', payload)
}

/**
 * Track checkout initiation — fires when user clicks a pricing CTA and
 * the /api/checkout request returns a NOWPayments URL.
 */
export function trackCheckoutStarted(props: {
  tier: string
  period?: string
  promoCode?: string
}): void {
  const payload = withUtm({
    tier: props.tier,
    period: props.period ?? 'monthly',
    promo_code: props.promoCode ?? null,
    currency: 'USD',
  })
  gtag('event', 'checkout_started', payload)
  phCapture('checkout_started', payload)
}

/**
 * Track successful payment confirmation (typically fired on the
 * /checkout/success redirect page or after IPN confirmation polling).
 */
export function trackPaymentSuccess(props: {
  tier: string
  amountUsd: number
  paymentMethod?: string
}): void {
  const payload = withUtm({
    tier: props.tier,
    value: props.amountUsd,
    currency: 'USD',
    payment_method: props.paymentMethod ?? 'nowpayments',
  })
  // GA4 purchase event (standard ecommerce)
  gtag('event', 'purchase', {
    transaction_id: `sophia_${Date.now()}`,
    value: props.amountUsd,
    currency: 'USD',
    items: [{ item_name: `Sophia ${props.tier}`, quantity: 1, price: props.amountUsd }],
    ...withUtm({}),
  })
  gtag('event', 'payment_success', payload)
  phCapture('payment_success', payload)
}

/**
 * Track tier upgrade (user moving from one paid tier to a higher one).
 */
export function trackTierUpgrade(props: {
  fromTier: string
  toTier: string
  amountUsd?: number
}): void {
  const payload = withUtm({
    from_tier: props.fromTier,
    to_tier: props.toTier,
    value: props.amountUsd ?? 0,
    currency: 'USD',
  })
  gtag('event', 'tier_upgrade', payload)
  phCapture('tier_upgrade', payload)
}

/**
 * Track checkout abandonment — call this when the user navigates away
 * after checkout_started but before payment_success.
 */
export function trackCheckoutAbandoned(props: { tier: string; reason?: string }): void {
  const payload = withUtm({
    tier: props.tier,
    reason: props.reason ?? 'page_unload',
  })
  gtag('event', 'checkout_abandoned', payload)
  phCapture('checkout_abandoned', payload)
}
