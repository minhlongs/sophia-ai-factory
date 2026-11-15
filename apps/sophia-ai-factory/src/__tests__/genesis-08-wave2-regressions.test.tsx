/**
 * Wave 2 Unmocked Contract & Security Regression Suite (Supreme Command #08)
 *
 * Verifies real behavioral invariants uncovered by Reviewers A, B, and C:
 * 1. Setup Wizard `buildReceiptPayload` returns a complete `ValidationReceipt`
 *    (with `verdict`, `provider`, `maskedKey`, `checkedAtUnix`) that renders
 *    cleanly inside `ValidationReceiptCard` without React crash.
 * 2. `/api/webhooks/payos` returns HTTP 503 (never 200 OK) when `FEATURE_PAYOS=false`
 *    so PayOS retries are preserved instead of silently acknowledged and dropped.
 * 3. `processPayOsPostFulfillment` converts VND into USD cents (`7900` cents for
 *    `1,990,000 VND`) before calling `safelyRecordAffiliateCommission`, preventing
 *    the 251.9x VND-as-USD-cents commission drain, and grants `500 MCU` idempotently.
 * 4. `/api/payos/ipn` rejects tampered unsigned `success: true` envelopes when
 *    signed `data.code !== '00'`.
 * 5. `/api/checkout` blocks promo codes on `pilot_14d` and uses a 25-minute
 *    dedupe window (not 24h) for PayOS links.
 * 6. `/api/cron/mcu-monthly-reset` skips expired `pilot_14d` subscriptions whose
 *    `status = 'active'` row has `current_period_end <= now`.
 * 7. `awaitPublishApproval` passes a per-subject `if: async.data.idempotencyKey == ...`
 *    correlation filter to `step.waitForEvent`, and `resolvePublishApproval` persists
 *    `compliance_json` on `publish_ledger` for downstream TikTok/YouTube uploaders.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  getD1Raw: vi.fn(),
  createServerClient: vi.fn(),
  getUserWorkspaceIds: vi.fn(),
  safelyRecordAffiliateCommission: vi.fn().mockResolvedValue(undefined),
  recordAudit: vi.fn().mockResolvedValue(undefined),
  sendReceiptEmail: vi.fn().mockResolvedValue(undefined),
  track: vi.fn(),
  addCredits: vi.fn().mockResolvedValue(undefined),
  verifyCronAuth: vi.fn().mockReturnValue(null),
  findActivePendingOrder: vi.fn().mockResolvedValue(null),
  getUserId: vi.fn().mockResolvedValue('user_pilot_buyer'),
  verifyCsrfToken: vi.fn().mockReturnValue(true),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.getD1,
  getD1Raw: mocks.getD1Raw,
  getD1Safe: mocks.getD1,
  createServerClient: mocks.createServerClient,
}));

vi.mock('@/seed/auth/workspace-access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/auth/workspace-access')>();
  return {
    ...actual,
    getUserWorkspaceIds: mocks.getUserWorkspaceIds,
  };
});

vi.mock('@/tree/affiliates/affiliate-attribution', () => ({
  safelyRecordAffiliateCommission: mocks.safelyRecordAffiliateCommission,
}));

vi.mock('@/seed/db/audit/audit-log', () => ({
  recordAudit: mocks.recordAudit,
}));

vi.mock('@/land/billing/email/receipt-email-sender', () => ({
  sendReceiptEmail: mocks.sendReceiptEmail,
}));

vi.mock('@/tree/signals/track', () => ({
  track: mocks.track,
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  addCredits: mocks.addCredits,
}));

vi.mock('@/seed/security/cron-auth', () => ({
  verifyCronAuth: mocks.verifyCronAuth,
}));

vi.mock('@/land/orders/pending-order-repo', () => ({
  findActivePendingOrder: mocks.findActivePendingOrder,
  writeOrder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/app/api/checkout/modules/checkout-auth', () => ({
  getUserId: mocks.getUserId,
}));

vi.mock('@/seed/security/csrf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/security/csrf')>();
  return {
    ...actual,
    verifyCsrfToken: mocks.verifyCsrfToken,
  };
});

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { buildReceiptPayload } from '@/tree/byok/receipt-payload-builder';
import { ValidationReceiptCard } from '@/tree/components/setup-wizard/validation-receipt-card';
import { POST as payosWebhookPost } from '@/app/api/webhooks/payos/route';
import { processPayOsPostFulfillment } from '@/app/api/webhooks/payos/modules/payos-fulfillment';
import { validatePayOsRequest } from '@/app/api/payos/ipn/modules/request-validator';
import { payOsCanonicalize } from '@/land/payments/payos-gateway/checksum-verifier';
import { POST as checkoutPost } from '@/app/api/checkout/route';
import { GET as mcuResetGet } from '@/app/api/cron/mcu-monthly-reset/route';
import { awaitPublishApproval } from '@/tree/publishing/approval/gate';
import { mapLedgerRow } from '@/tree/publishing/approval/ledger-store';

async function signPayOsPayload(payloadWithoutSig: Record<string, unknown>, secret: string): Promise<string> {
  const canonical = payOsCanonicalize(JSON.stringify(payloadWithoutSig));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(canonical));
  const signature = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return JSON.stringify({ ...payloadWithoutSig, signature });
}

describe('Supreme Command #08 — Wave 2 Security & Contract Regressions', () => {
  const savedFeaturePayOs = process.env.FEATURE_PAYOS;
  const savedChecksum = process.env.PAYOS_CHECKSUM_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedFeaturePayOs === undefined) delete process.env.FEATURE_PAYOS;
    else process.env.FEATURE_PAYOS = savedFeaturePayOs;
    if (savedChecksum === undefined) delete process.env.PAYOS_CHECKSUM_KEY;
    else process.env.PAYOS_CHECKSUM_KEY = savedChecksum;
  });

  it('C-P0-1: buildReceiptPayload.payload renders directly inside ValidationReceiptCard without crashing', async () => {
    mocks.getUserWorkspaceIds.mockResolvedValueOnce(['org_pilot_1']);
    mocks.getD1.mockResolvedValueOnce({
      prepare(sql: string) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes('FROM user_api_keys')) {
                  return {
                    capability_mask: 'json_schema,tool_call,vision',
                    monthly_budget_usd: 20,
                    cooldown_until: null,
                  };
                }
                return { total_cents: 450 };
              },
            };
          },
        };
      },
    });

    const { payload } = await buildReceiptPayload({
      userId: 'user_1',
      provider: 'openrouter',
      maskedKey: 'sk-or-...9999',
      nowUnix: 1_794_700_000,
    });

    expect(payload.verdict).toEqual({ outcome: 'within_budget', remainingUsd: 15.5 });
    expect(payload.provider).toBe('openrouter');
    expect(payload.maskedKey).toBe('sk-or-...9999');

    render(<ValidationReceiptCard receipt={payload} latencyMs={142} />);
    expect(screen.getByTestId('validation-receipt-openrouter')).toBeDefined();
    expect(screen.getByText('sk-or-...9999')).toBeDefined();
    expect(screen.getByText('142ms')).toBeDefined();
    expect(screen.getByText('$4.50 / $20.00')).toBeDefined();
  });

  it('A-P0-3: /api/webhooks/payos returns 503 (never 200) when FEATURE_PAYOS=false so PayOS retries are preserved', async () => {
    process.env.FEATURE_PAYOS = 'false';
    const req = new NextRequest('https://sophia.agencyos.network/api/webhooks/payos', {
      method: 'POST',
      body: JSON.stringify({ code: '00', data: { orderCode: 123, amount: 1_990_000 } }),
    });

    const res = await payosWebhookPost(req);
    expect(res.status).toBe(503);
  });

  it('A-P0-1 & A-P1-1: processPayOsPostFulfillment passes USD cents (7900, never 1990000 VND) to affiliate attribution and grants 500 MCU once', async () => {
    const runCalls: Array<{ sql: string; args: unknown[] }> = [];
    let txInserted = false;
    const rawDb = {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              async run() {
                runCalls.push({ sql, args });
                if (sql.includes('INSERT INTO mcu_transactions')) {
                  if (txInserted) return { meta: { changes: 0 } };
                  txInserted = true;
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    };
    mocks.getD1Raw.mockResolvedValue(rawDb);

    const dbClient = {
      unwrap: () => rawDb,
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { name: 'Founder', email: 'founder@sme.vn' } }),
          }),
        }),
      }),
    };

    const order = {
      order_id: 'sophia_user_pilot_100',
      user_id: 'user_pilot',
      tier: 'BASIC' as const,
      period: 'pilot_14d' as const,
      payment_method: 'payos' as const,
      amount_usd_cents: 7900,
      amount_vnd: 1_990_000,
      promo_code: null,
      customer_email: 'founder@sme.vn',
      invoice_url: 'https://pay.payos.vn/web/plink_100',
      status: 'completed' as const,
      payment_id: 'payos_plink_100',
      created_at: '2026-11-15T00:00:00.000Z',
      completed_at: '2026-11-15T00:01:00.000Z',
      provider_payment_id: 'plink_100',
    };

    await processPayOsPostFulfillment({
      db: dbClient as never,
      userId: 'user_pilot',
      tier: 'BASIC',
      order,
      paymentLinkId: 'plink_100',
      amount: 1_990_000,
      orgId: 'org_pilot',
      periodEnd: '2026-11-29T00:01:00.000Z',
      isLifetime: false,
    });

    // Replay must NOT double-credit user_mcu_balance
    await processPayOsPostFulfillment({
      db: dbClient as never,
      userId: 'user_pilot',
      tier: 'BASIC',
      order,
      paymentLinkId: 'plink_100',
      amount: 1_990_000,
      orgId: 'org_pilot',
      periodEnd: '2026-11-29T00:01:00.000Z',
      isLifetime: false,
    });

    expect(mocks.safelyRecordAffiliateCommission).toHaveBeenCalledWith(
      {
        provider: 'payos',
        paymentId: 'plink_100',
        orderId: 'sophia_user_pilot_100',
        customerId: 'user_pilot',
        grossAmountCents: 7900,
        currency: 'USD',
      },
      rawDb,
    );

    const balanceGrants = runCalls.filter((c) => c.sql.includes('INSERT INTO user_mcu_balance'));
    expect(balanceGrants).toHaveLength(1);
    expect(balanceGrants[0]?.args[1]).toBe(500);
  });

  it('A-P0-2: /api/payos/ipn ignores forged unsigned top-level success:true when signed data.code !== "00"', async () => {
    const secret = 'ipn-test-checksum-secret';
    process.env.PAYOS_CHECKSUM_KEY = secret;

    // Attacker takes a legitimately signed non-payment / failed data payload (code: "09")
    // and flips unsigned top-level `success` to `true`.
    const bodyStr = await signPayOsPayload(
      {
        code: '00',
        desc: 'forged',
        success: true,
        data: {
          orderCode: 889900,
          amount: 1_990_000,
          description: 'Sophia BASIC',
          paymentLinkId: 'plink_failed_1',
          code: '09',
          desc: 'Cancelled',
        },
      },
      secret,
    );

    const req = new NextRequest('https://sophia.agencyos.network/api/payos/ipn', {
      method: 'POST',
      body: bodyStr,
    });

    const validated = await validatePayOsRequest(req, secret);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.data.success).toBe(false);
    }
  });

  it('A-P2-1 & A-P2-2: /api/checkout blocks promoCode on pilot_14d and queries a 25m dedupe window for PayOS', async () => {
    process.env.FEATURE_PAYOS = 'false';

    const promoAttempt = new NextRequest('https://sophia.agencyos.network/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: 'BASIC',
        period: 'pilot_14d',
        paymentMethod: 'payos',
        promoCode: 'FREE100',
      }),
    });
    const promoRes = await checkoutPost(promoAttempt);
    expect(promoRes.status).toBe(400);

    const cleanPilot = new NextRequest('https://sophia.agencyos.network/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: 'BASIC',
        period: 'pilot_14d',
        paymentMethod: 'payos',
      }),
    });
    const cleanRes = await checkoutPost(cleanPilot);
    expect(cleanRes.status).toBe(200);
    expect(mocks.findActivePendingOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: 'payos',
        period: 'pilot_14d',
        sinceMs: 25 * 60 * 1000,
      }),
    );
  });

  it('A-P1-3: /api/cron/mcu-monthly-reset skips expired pilot_14d rows while topping up unexpired active rows', async () => {
    const nowMs = Date.UTC(2026, 11, 1, 0, 0, 0);
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(nowMs);
    try {
      mocks.createServerClient.mockReturnValueOnce({
        from: () => ({
          select: () => ({
            eq: async () => ({
              data: [
                {
                  user_id: 'expired_pilot_user',
                  tier: 'BASIC',
                  plan: 'basic',
                  current_period_end: '2026-11-29T00:00:00.000Z',
                },
                {
                  user_id: 'active_monthly_user',
                  tier: 'BASIC',
                  plan: 'basic',
                  current_period_end: '2026-12-15T00:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      const req = new NextRequest('https://sophia.agencyos.network/api/cron/mcu-monthly-reset');
      const res = await mcuResetGet(req);
      const body = (await res.json()) as { ok: boolean; processed: number };

      expect(body.ok).toBe(true);
      expect(body.processed).toBe(1);
      expect(mocks.addCredits).toHaveBeenCalledTimes(1);
      expect(mocks.addCredits).toHaveBeenCalledWith(
        'active_monthly_user',
        expect.any(Number),
        'monthly_subscription_reset',
        expect.any(Object),
      );
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('B-P0-3 & B-P1-1: awaitPublishApproval correlates waitForEvent by idempotencyKey and forwards persisted compliance_json', async () => {
    const mapped = mapLedgerRow({
      idempotency_key: 'pub_key_tiktok_99',
      tenant_id: 'org_alpha',
      channel_id: 'tt_chan_1',
      platform: 'tiktok',
      media_ref: 'https://media.sophia.agencyos.network/org_alpha/v1.mp4',
      decision: 'approved',
      requester_id: 'u_creator',
      reviewer_id: 'u_admin',
      comment: 'Compliant',
      compliance_json: JSON.stringify({
        privacyLevel: 'SELF_ONLY',
        brandOrganicToggle: true,
        musicUsageConfirmed: true,
      }),
      approved_at: 1_794_700_100,
      expires_at: 1_794_786_400,
      created_at: 1_794_700_000,
    });
    expect(mapped.compliance).toEqual({
      privacyLevel: 'SELF_ONLY',
      brandOrganicToggle: true,
      musicUsageConfirmed: true,
    });

    let readCount = 0;
    mocks.getD1.mockResolvedValue({
      prepare(sql: string) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes('SELECT * FROM publish_ledger')) {
                  readCount += 1;
                  return readCount === 1
                    ? null
                    : {
                        idempotency_key: 'pub_key_tiktok_99',
                        tenant_id: 'org_alpha',
                        channel_id: 'tt_chan_1',
                        platform: 'tiktok',
                        media_ref: 'https://media.sophia.agencyos.network/org_alpha/v1.mp4',
                        decision: 'approved',
                        reviewer_id: 'u_admin',
                        comment: null,
                        compliance_json: JSON.stringify({
                          privacyLevel: 'PUBLIC_TO_EVERYONE',
                          brandOrganicToggle: true,
                          musicUsageConfirmed: true,
                        }),
                        approved_at: 1_794_700_050,
                        expires_at: 1_794_786_400,
                        created_at: 1_794_700_000,
                      };
                }
                return null;
              },
              async run() {
                return { meta: { changes: 1 } };
              },
            };
          },
          async run() {
            return { meta: { changes: 0 } };
          },
        };
      },
    });

    const waitForEvent = vi.fn().mockResolvedValue({ data: { decision: 'approved' } });
    const sendEvent = vi.fn().mockResolvedValue({ ids: ['evt_1'] });
    const gateRes = await awaitPublishApproval(
      {
        tenantId: 'org_alpha',
        channelId: 'tt_chan_1',
        platform: 'tiktok',
        mediaRef: 'https://media.sophia.agencyos.network/org_alpha/v1.mp4',
        requestedPrivacy: 'public',
        nowSeconds: () => 1_794_700_000,
      },
      {
        run: async (_id, fn) => fn(),
        waitForEvent,
        sendEvent,
      },
    );

    expect(waitForEvent).toHaveBeenCalledTimes(1);
    const waitOpts = waitForEvent.mock.calls[0]?.[1] as { if?: string };
    expect(waitOpts.if).toMatch(/^async\.data\.idempotencyKey == '[a-f0-9]+'$/);
    expect(gateRes.state.outcome).toBe('allowed');
    expect(gateRes.compliance).toEqual({
      privacyLevel: 'PUBLIC_TO_EVERYONE',
      brandOrganicToggle: true,
      musicUsageConfirmed: true,
    });
  });
});
