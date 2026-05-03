/**
 * Auto-handover orchestrator unit tests.
 * Covers: new customer, existing customer upgrade, idempotency, user-create failure.
 * @vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerAutoHandover } from '@/tree/handover/auto-handover';
import * as accountSetup from '@/tree/handover/handover-account-setup';
import * as magicLink from '@/tree/handover/handover-magic-link';
import * as emailService from '@/tree/handover/handover-email-service';
import * as emailOutbox from '@/forest/outbox/email-outbox';

// ── Shared mock state ──────────────────────────────────────────────────────────

const mockDb = {
  prepare: vi.fn(),
  from: vi.fn(),
};

// D1 prepare chain
function makeD1Chain(firstResult: unknown, remainingResult: unknown = null) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    run: vi.fn().mockResolvedValue({ success: true }),
  };
  return stmt;
}

vi.mock('@/seed/db/client', () => ({
  getD1Raw: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('../handover-account-setup', () => ({
  createCustomerUser: vi.fn(),
  upsertUserTier: vi.fn(),
  preInstallSops: vi.fn(),
  createHandoverRecord: vi.fn(),
}));

vi.mock('../handover-magic-link', () => ({
  createMagicLinkToken: vi.fn(),
}));

vi.mock('../handover-email-service', () => ({
  sendAutoHandoverWelcomeEmail: vi.fn(),
  sendTierUpgradeEmail: vi.fn(),
}));

vi.mock('@/forest/outbox/email-outbox', () => ({
  enqueueWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

import { getD1Raw } from '@/seed/db/client';

// ── Helper ─────────────────────────────────────────────────────────────────────

function makeDbWithResponses(responses: Array<unknown>) {
  let callCount = 0;
  const db = {
    prepare: vi.fn().mockImplementation(() => {
      const idx = callCount++;
      return {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(responses[idx] ?? null),
        run: vi.fn().mockResolvedValue({ success: true }),
      };
    }),
  };
  return db as unknown as D1Database;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('triggerAutoHandover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(accountSetup.upsertUserTier).mockResolvedValue(undefined);
    vi.mocked(accountSetup.preInstallSops).mockResolvedValue(['weekly-newsletter', 'daily-tiktok', 'proposal-auto-pilot']);
    vi.mocked(accountSetup.createHandoverRecord).mockResolvedValue('handover-abc');
    vi.mocked(magicLink.createMagicLinkToken).mockResolvedValue('tok_abc123');
    vi.mocked(emailService.sendAutoHandoverWelcomeEmail).mockResolvedValue(undefined);
    vi.mocked(emailService.sendTierUpgradeEmail).mockResolvedValue(undefined);
    vi.mocked(emailOutbox.enqueueWelcomeEmail).mockResolvedValue(undefined);
  });

  it('skips on duplicate paymentId (idempotency)', async () => {
    // First call: handover already exists for this paymentId
    const db = makeDbWithResponses([{ id: 'existing-handover' }]);
    vi.mocked(getD1Raw).mockResolvedValue(db);

    const result = await triggerAutoHandover({
      paymentId: 'pay_dup123',
      email: 'user@example.com',
      tier: 'BASIC',
      isFirstPurchase: true,
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('duplicate_payment_id');
    expect(accountSetup.createCustomerUser).not.toHaveBeenCalled();
  });

  it('creates new customer for first purchase', async () => {
    // Responses: [handoverExists=null, findUserByEmail=null]
    // then after createCustomerUser: [getExistingHandoverId=null, countUserPurchases={cnt:1}]
    const db = makeDbWithResponses([
      null,           // handoverExistsForPayment → not found
      null,           // findUserByEmail → not found
      null,           // getExistingHandoverId → no prior handover
      { cnt: 1 },     // countUserPurchases → 1
    ]);
    vi.mocked(getD1Raw).mockResolvedValue(db);
    vi.mocked(accountSetup.createCustomerUser).mockResolvedValue('new-user-id');

    const result = await triggerAutoHandover({
      paymentId: 'pay_new001',
      email: 'newcustomer@test.com',
      tier: 'BASIC',
      isFirstPurchase: true,
    });

    expect(accountSetup.createCustomerUser).toHaveBeenCalledWith(db, 'newcustomer@test.com', 'newcustomer');
    expect(result.isNewCustomer).toBe(true);
    expect(result.handoverId).toBe('handover-abc');
    expect(result.skipped).toBe(false);
    expect(emailOutbox.enqueueWelcomeEmail).toHaveBeenCalledOnce();
  });

  it('sends tier-upgrade email for existing customer second purchase', async () => {
    const db = makeDbWithResponses([
      null,                      // handoverExistsForPayment → not found
      { id: 'existing-user' },   // findUserByEmail → found
      { id: 'existing-hov' },    // getExistingHandoverId → has prior handover
      { cnt: 3 },                // countUserPurchases → 3 (upgrade)
    ]);
    vi.mocked(getD1Raw).mockResolvedValue(db);

    const result = await triggerAutoHandover({
      paymentId: 'pay_upg001',
      email: 'existing@test.com',
      tier: 'PREMIUM',
      isFirstPurchase: false,
    });

    expect(result.skipped).toBe(false);
    expect(result.handoverId).toBe('existing-hov');
    expect(emailService.sendTierUpgradeEmail).toHaveBeenCalledOnce();
    expect(emailOutbox.enqueueWelcomeEmail).not.toHaveBeenCalled();
    expect(accountSetup.createHandoverRecord).not.toHaveBeenCalled();
  });

  it('returns skipped if createCustomerUser throws', async () => {
    const db = makeDbWithResponses([null, null]); // not found, not found
    vi.mocked(getD1Raw).mockResolvedValue(db);
    vi.mocked(accountSetup.createCustomerUser).mockRejectedValue(new Error('DB constraint'));

    const result = await triggerAutoHandover({
      paymentId: 'pay_fail001',
      email: 'fail@test.com',
      tier: 'BASIC',
      isFirstPurchase: true,
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('user_create_failed');
  });

  it('generates magic link and attaches to result', async () => {
    const db = makeDbWithResponses([null, null, null, { cnt: 1 }]);
    vi.mocked(getD1Raw).mockResolvedValue(db);
    vi.mocked(accountSetup.createCustomerUser).mockResolvedValue('usr-magic');
    vi.mocked(magicLink.createMagicLinkToken).mockResolvedValue('tok_magic999');

    const result = await triggerAutoHandover({
      paymentId: 'pay_magic',
      email: 'magic@test.com',
      tier: 'PREMIUM',
      isFirstPurchase: true,
    });

    expect(result.magicLink).toContain('tok_magic999');
    expect(result.magicLink).toContain('/welcome/');
  });
});
