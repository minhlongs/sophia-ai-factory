/**
 * Stripe Connect Express — onboarding, status sync, fiat transfer helpers.
 * @module land/payouts/stripe-connect
 */

import Stripe from 'stripe';
import { logger } from '@/seed/utils/logger-utility';
import {
  deriveAccountStatus,
  type StripeAccountStatus,
  type CreateOnboardLinkInput,
  type CreateOnboardLinkResult,
  type ApplyAccountUpdateInput,
  type ApplyAccountUpdateResult,
} from './stripe-connect-types';

export {
  deriveAccountStatus,
  type StripeAccountStatus,
  type CreateOnboardLinkInput,
  type CreateOnboardLinkResult,
  type ApplyAccountUpdateInput,
  type ApplyAccountUpdateResult,
};

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

/** Create (or reuse) a Stripe Connect Express account and return an Account Link URL. */
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
      capabilities: { transfers: { requested: true } },
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

  return { accountId, url: link.url, expiresAt: link.expires_at };
}

/** Send a fiat USD payout to a connected affiliate. */
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

/** Verify Stripe webhook signature. */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
): Stripe.Event | null {
  if (!signatureHeader) return null;
  try {
    return getStripeClient().webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
  } catch (err) {
    logger.warn('[stripe-connect] webhook signature verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
