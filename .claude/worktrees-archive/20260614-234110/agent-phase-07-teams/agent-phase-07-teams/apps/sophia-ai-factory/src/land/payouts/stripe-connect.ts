/**
 * Stripe Connect Express — onboarding, status sync, fiat transfer helpers.
 *
 * Domain: land/payouts (business workflow).
 * Used by:
 *   - app/api/connect/onboard         → createOnboardLink
 *   - app/api/webhooks/stripe-connect → applyAccountUpdate
 *   - payout-batcher (future)         → transferToConnectedAccount
 *
 * Design:
 *   - Lazy Stripe SDK init — secret read on first use; throws if missing.
 *   - All exported fns are pure orchestrators; DB writes via passed D1Database.
 *   - Status mapping is the single source of truth for stripe_payout_enabled flag.
 *
 * @module land/payouts/stripe-connect
 */

import Stripe from 'stripe';
import { logger } from '@/seed/utils/logger-utility';

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

let stripeSingleton: Stripe | null = null;

/** Lazy Stripe SDK — secret read once. Throws if STRIPE_SECRET_KEY missing. */
export function getStripeClient(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY env var not set — Stripe Connect unavailable');
  }
  stripeSingleton = new Stripe(secret, {
    apiVersion: '2023-10-16',
    typescript: true,
    maxNetworkRetries: 2,
  });
  return stripeSingleton;
}

/** Override singleton for tests. Pass null to reset. */
export function __setStripeClientForTesting(client: Stripe | null): void {
  stripeSingleton = client;
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

/**
 * Create (or reuse) a Stripe Connect Express account and return an Account Link
 * URL the user can navigate to in order to complete KYC.
 *
 * Caller is responsible for persisting result.accountId to user_payout_settings
 * (we keep this pure to ease testing and avoid passing DB into core domain logic).
 */
export async function createOnboardLink(
  input: CreateOnboardLinkInput,
): Promise<CreateOnboardLinkResult> {
  const stripe = getStripeClient();

  let accountId = input.existingAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: input.country ?? 'US',
      email: input.email,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: { user_id: input.userId },
    });
    accountId = account.id;
    logger.info('[stripe-connect] created Express account', { userId: input.userId, accountId });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: input.refreshUrl,
    return_url: input.returnUrl,
    type: 'account_onboarding',
  });

  return {
    accountId,
    url: link.url,
    expiresAt: link.expires_at,
  };
}

/**
 * Send a fiat USD payout to a connected affiliate.
 * @param amountCents amount in USD cents — use commission-cents conversions upstream.
 * @param idempotencyKey REQUIRED — payout cron must derive a stable key (e.g. payout_batch_id).
 */
export async function transferToConnectedAccount(args: {
  destinationAccountId: string;
  amountCents: number;
  idempotencyKey: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<{ transferId: string; created: number }> {
  const stripe = getStripeClient();
  const transfer = await stripe.transfers.create(
    {
      amount: args.amountCents,
      currency: 'usd',
      destination: args.destinationAccountId,
      description: args.description,
      metadata: args.metadata,
    },
    { idempotencyKey: args.idempotencyKey },
  );
  logger.info('[stripe-connect] transfer created', {
    transferId: transfer.id,
    destination: args.destinationAccountId,
    amountCents: args.amountCents,
  });
  return { transferId: transfer.id, created: transfer.created };
}

/**
 * Verify Stripe webhook signature.
 * Uses the SDK's helper which implements the t=<ts>,v1=<sig> format with timing-safe compare.
 * Returns the parsed Event on success or null on signature failure / parse error.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
): Stripe.Event | null {
  if (!signatureHeader) return null;
  try {
    const stripe = getStripeClient();
    return stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
  } catch (err) {
    logger.warn('[stripe-connect] webhook signature verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
