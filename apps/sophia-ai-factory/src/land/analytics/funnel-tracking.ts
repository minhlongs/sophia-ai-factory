/**
 * Funnel event tracking helpers — server-side wrappers around captureServer().
 *
 * Each function maps to a key growth funnel step and should be called from
 * the server action / route handler / hook where that step completes.
 *
 * Fire-and-forget friendly: resolves quickly, errors silently logged.
 *
 * @module forest/analytics/funnel-tracking
 */

import { captureServer } from '@/forest/telemetry/posthog-capture'
import { Events } from '@/forest/telemetry/event-types'

/**
 * Track when a user completes registration (server-side).
 * Called from the Better Auth database hook after user row creation.
 */
export async function trackSignup(
  userId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  await captureServer({
    event: Events.SIGNUP,
    distinctId: userId,
    source: 'server',
    properties,
  })
}

/**
 * Track when a user completes the Setup Wizard (BYOK credential entry).
 * Called from the save-credentials route handler on success.
 */
export async function trackSetupWizardComplete(
  userId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  await captureServer({
    event: Events.WIZARD_COMPLETED,
    distinctId: userId,
    source: 'server',
    properties,
  })
}

/**
 * Track when a user renders their first video.
 * Called from the render-byok-video module after successful HeyGen submission.
 */
export async function trackFirstVideo(
  userId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  await captureServer({
    event: Events.VIDEO_RENDERED,
    distinctId: userId,
    source: 'server',
    properties,
  })
}

/**
 * Track when a user completes a payment (server-side, from webhook).
 * Called from the NOWPayments IPN webhook on payment_succeeded.
 */
export async function trackPaid(
  userId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  await captureServer({
    event: Events.PAYMENT_SUCCEEDED,
    distinctId: userId,
    source: 'server',
    properties,
  })
}

/**
 * Track when a user installs an SOP from the Creator Marketplace.
 * Called from the install-handler server action on success.
 */
export async function trackSopInstalled(
  userId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  await captureServer({
    event: Events.SOP_INSTALLED,
    distinctId: userId,
    source: 'server',
    properties,
  })
}

/**
 * Track when a user uninstalls an SOP.
 * Called from the install-handler server action after status update.
 */
export async function trackSopUninstalled(
  userId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  await captureServer({
    event: Events.SOP_UNINSTALLED,
    distinctId: userId,
    source: 'server',
    properties,
  })
}

/**
 * Track when a user views a marketplace listing detail page.
 * Called from the marketplace detail server component on render.
 */
export async function trackSopListedViewed(
  userId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  await captureServer({
    event: Events.SOP_LISTING_VIEWED,
    distinctId: userId,
    source: 'server',
    properties,
  })
}

/**
 * Track when a referral signup is recorded (referral code applied).
 * Called from the referral/apply route after successful code application.
 */
export async function trackReferralSignup(
  userId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  await captureServer({
    event: Events.REFERRAL_SIGNUP,
    distinctId: userId,
    source: 'server',
    properties,
  })
}
