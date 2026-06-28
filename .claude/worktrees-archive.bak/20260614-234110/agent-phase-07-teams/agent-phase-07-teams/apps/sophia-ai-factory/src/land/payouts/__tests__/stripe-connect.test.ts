/**
 * Stripe Connect — service module tests.
 * Pure unit tests with the Stripe SDK injected via __setStripeClientForTesting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __setStripeClientForTesting,
  createOnboardLink,
  deriveAccountStatus,
  getStripeClient,
  transferToConnectedAccount,
  verifyWebhookSignature,
} from '@/land/payouts/stripe-connect';

type StripeMock = {
  accounts: { create: ReturnType<typeof vi.fn> };
  accountLinks: { create: ReturnType<typeof vi.fn> };
  transfers: { create: ReturnType<typeof vi.fn> };
  webhooks: { constructEvent: ReturnType<typeof vi.fn> };
};

function buildMockStripe(): StripeMock {
  return {
    accounts: { create: vi.fn() },
    accountLinks: { create: vi.fn() },
    transfers: { create: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  };
}

describe('deriveAccountStatus', () => {
  it('returns enabled when all flags set', () => {
    const r = deriveAccountStatus({
      accountId: 'acct_1',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    });
    expect(r).toEqual({ status: 'enabled', payoutEnabled: true });
  });

  it('returns restricted when details submitted but charges/payouts not enabled', () => {
    const r = deriveAccountStatus({
      accountId: 'acct_1',
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: true,
    });
    expect(r).toEqual({ status: 'restricted', payoutEnabled: false });
  });

  it('returns pending when details NOT submitted', () => {
    const r = deriveAccountStatus({
      accountId: 'acct_1',
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    });
    expect(r).toEqual({ status: 'pending', payoutEnabled: false });
  });

  it('returns rejected when requirements.disabled_reason starts with rejected.', () => {
    const r = deriveAccountStatus({
      accountId: 'acct_1',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      requirementsDisabledReason: 'rejected.fraud',
    });
    expect(r).toEqual({ status: 'rejected', payoutEnabled: false });
  });

  it('does NOT return rejected for non-rejected disabled reasons', () => {
    const r = deriveAccountStatus({
      accountId: 'acct_1',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      requirementsDisabledReason: 'requirements.past_due',
    });
    expect(r.status).toBe('enabled');
  });
});

describe('getStripeClient', () => {
  beforeEach(() => {
    __setStripeClientForTesting(null);
  });

  afterEach(() => {
    __setStripeClientForTesting(null);
  });

  it('throws when STRIPE_SECRET_KEY missing', () => {
    const original = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      expect(() => getStripeClient()).toThrow(/STRIPE_SECRET_KEY/);
    } finally {
      if (original !== undefined) process.env.STRIPE_SECRET_KEY = original;
    }
  });
});

describe('createOnboardLink', () => {
  let stripe: StripeMock;

  beforeEach(() => {
    stripe = buildMockStripe();
    __setStripeClientForTesting(stripe as unknown as Parameters<typeof __setStripeClientForTesting>[0]);
  });

  afterEach(() => {
    __setStripeClientForTesting(null);
  });

  it('creates a new account when no existingAccountId provided', async () => {
    stripe.accounts.create.mockResolvedValueOnce({ id: 'acct_NEW' });
    stripe.accountLinks.create.mockResolvedValueOnce({
      url: 'https://connect.stripe.com/express/onboarding/x',
      expires_at: 1_700_000_000,
    });

    const result = await createOnboardLink({
      userId: 'u1',
      returnUrl: 'https://app/return',
      refreshUrl: 'https://app/refresh',
      email: 'a@b.co',
    });

    expect(result.accountId).toBe('acct_NEW');
    expect(stripe.accounts.create).toHaveBeenCalledTimes(1);
    expect(stripe.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'express',
        country: 'US',
        email: 'a@b.co',
        metadata: { user_id: 'u1' },
      }),
    );
    expect(stripe.accountLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        account: 'acct_NEW',
        type: 'account_onboarding',
      }),
    );
  });

  it('reuses existingAccountId without creating a new account', async () => {
    stripe.accountLinks.create.mockResolvedValueOnce({
      url: 'https://connect.stripe.com/express/onboarding/y',
      expires_at: 1_700_000_001,
    });

    const result = await createOnboardLink({
      userId: 'u1',
      existingAccountId: 'acct_EXISTING',
      returnUrl: 'https://app/return',
      refreshUrl: 'https://app/refresh',
    });

    expect(result.accountId).toBe('acct_EXISTING');
    expect(stripe.accounts.create).not.toHaveBeenCalled();
    expect(stripe.accountLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'acct_EXISTING' }),
    );
  });

  it('honors country override', async () => {
    stripe.accounts.create.mockResolvedValueOnce({ id: 'acct_VN' });
    stripe.accountLinks.create.mockResolvedValueOnce({ url: 'u', expires_at: 0 });
    await createOnboardLink({
      userId: 'u',
      returnUrl: 'r',
      refreshUrl: 'f',
      country: 'VN',
    });
    expect(stripe.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'VN' }),
    );
  });
});

describe('transferToConnectedAccount', () => {
  let stripe: StripeMock;

  beforeEach(() => {
    stripe = buildMockStripe();
    __setStripeClientForTesting(stripe as unknown as Parameters<typeof __setStripeClientForTesting>[0]);
  });

  afterEach(() => {
    __setStripeClientForTesting(null);
  });

  it('calls transfers.create with idempotencyKey and returns transfer id', async () => {
    stripe.transfers.create.mockResolvedValueOnce({ id: 'tr_1', created: 1_700_000_000 });
    const result = await transferToConnectedAccount({
      destinationAccountId: 'acct_1',
      amountCents: 5000,
      idempotencyKey: 'batch-abc',
      description: 'May payout',
      metadata: { batch_id: 'abc' },
    });
    expect(result).toEqual({ transferId: 'tr_1', created: 1_700_000_000 });
    expect(stripe.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: 'usd',
        destination: 'acct_1',
        metadata: { batch_id: 'abc' },
      }),
      { idempotencyKey: 'batch-abc' },
    );
  });

  it('propagates Stripe SDK errors (caller decides retry)', async () => {
    stripe.transfers.create.mockRejectedValueOnce(new Error('insufficient_funds'));
    await expect(
      transferToConnectedAccount({
        destinationAccountId: 'acct_1',
        amountCents: 100,
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow(/insufficient_funds/);
  });
});

describe('verifyWebhookSignature', () => {
  let stripe: StripeMock;

  beforeEach(() => {
    stripe = buildMockStripe();
    __setStripeClientForTesting(stripe as unknown as Parameters<typeof __setStripeClientForTesting>[0]);
  });

  afterEach(() => {
    __setStripeClientForTesting(null);
  });

  it('returns null when signature header missing', () => {
    const result = verifyWebhookSignature('{}', null, 'whsec_test');
    expect(result).toBeNull();
    expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
  });

  it('returns parsed event on valid signature', () => {
    const fakeEvent = { id: 'evt_1', type: 'account.updated', data: { object: {} } };
    stripe.webhooks.constructEvent.mockReturnValueOnce(fakeEvent);
    const result = verifyWebhookSignature('{"x":1}', 't=1,v1=abc', 'whsec_test');
    expect(result).toBe(fakeEvent);
  });

  it('returns null and swallows error on signature mismatch', () => {
    stripe.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const result = verifyWebhookSignature('{}', 't=1,v1=bad', 'whsec_test');
    expect(result).toBeNull();
  });
});
