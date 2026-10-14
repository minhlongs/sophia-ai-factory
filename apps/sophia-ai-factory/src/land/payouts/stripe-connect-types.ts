/**
 * Stripe Connect Express types and account status derivation helper.
 * @module land/payouts/stripe-connect-types
 */

export type StripeAccountStatus = 'pending' | 'enabled' | 'restricted' | 'rejected';

export interface CreateOnboardLinkInput {
  userId: string;
  /** Existing acct_... if onboarding was previously started; undefined creates a new one. */
  existingAccountId?: string;
  /** URL Stripe redirects to on success — typically /dashboard/affiliate?connect=success */
  returnUrl: string;
  /** URL Stripe redirects to if the user re-requests the link (token expires after ~5min) */
  refreshUrl: string;
  email?: string;
  /** ISO 3166-1 alpha-2 — defaults to 'US'. Stripe Connect coverage varies by country. */
  country?: string;
}

export interface CreateOnboardLinkResult {
  accountId: string;
  url: string;
  expiresAt: number;
}

export interface ApplyAccountUpdateInput {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDisabledReason?: string | null;
}

export interface ApplyAccountUpdateResult {
  status: StripeAccountStatus;
  payoutEnabled: boolean;
}

/**
 * Map Stripe account flags → internal status enum.
 * Single source of truth for whether we treat the account as "ready to receive payouts".
 */
export function deriveAccountStatus(input: ApplyAccountUpdateInput): ApplyAccountUpdateResult {
  if (input.requirementsDisabledReason && input.requirementsDisabledReason.startsWith('rejected.')) {
    return { status: 'rejected', payoutEnabled: false };
  }
  if (input.chargesEnabled && input.payoutsEnabled && input.detailsSubmitted) {
    return { status: 'enabled', payoutEnabled: true };
  }
  if (input.detailsSubmitted) {
    return { status: 'restricted', payoutEnabled: false };
  }
  return { status: 'pending', payoutEnabled: false };
}
