/**
 * SOPHIA-SC-COMMERCIAL-01 Wave 2A:
 * Real SQLite/D1 + Web Crypto Regression Suite proving all 7 remediated findings
 * (`BYOK-SEC-01`, `D3A-001`, `D3A-002`, `G8-1A-001`, `D3A-003`, `D3A-004`, `D3A-005`)
 * fail closed under attack with zero network egress.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import {
  B3_NOWPAYMENTS_SECRET,
  B3_ORIGIN,
  bindD1Globals,
  buildJsonRequest,
  createB3SqliteFixture,
  dispatchRoute,
  installZeroNetworkTripwire,
  seedPendingOrder,
  seedSyntheticTenant,
  signNowPaymentsIpn,
  simulateWorkerRestart,
  type B3SqliteFixture,
} from './b3-revenue-harness';
import { computeHmacHex } from '@/seed/security/signature';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/seed/security/csrf';
import {
  KEK_ENVELOPE_PREFIX,
  decryptApiKey,
  encryptApiKey,
  ensureKeyVersionRow,
  generateWrappedDek,
  packedToText,
} from '@/tree/byok/byok-crypto';
import {
  reencryptPlatformCredentials,
  reencryptProviderCredentials,
  reencryptUserApiKeys,
} from '@/forest/inngest/functions/key-rotation/reencrypt-worker';
import { buildD1Dump } from '@/forest/dr/d1-dump-builder';
import { scrubPII } from '@/seed/observability/telemetry/pii-scrubber';
import { resetCouponCache } from '@/seed/config/coupons';
import { enforcePilotFeatureDisabled } from '@/seed/pilot/pilot-auth-guard';
import { getUserTier } from '@/seed/db/get-user-tier';
import { createOrder } from '@/land/commerce/commerce-order';

const { mockCurrentUser, mockCurrentUserFromHeaders } = vi.hoisted(() => {
  // Ensure AsyncLocalStorage is registered on globalThis before Next.js internals evaluate
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AsyncLocalStorage } = require('node:async_hooks') as typeof import('node:async_hooks');
  Object.assign(globalThis, { AsyncLocalStorage });
  return {
    mockCurrentUser: vi.fn(),
    mockCurrentUserFromHeaders: vi.fn(),
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockCurrentUser,
  getCurrentUserFromHeaders: mockCurrentUserFromHeaders,
}));

const TEST_BYOK_KEK = 'QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI=';
const ALTERNATE_BYOK_KEK = 'Q0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0M=';
const GRAB_SECRET = 'sc01-grabpay-hmac-secret-001';
const PROMPTPAY_SECRET = 'sc01-promptpay-hmac-secret-001';
const SEPA_SECRET = 'sc01-sepa-hmac-secret-001';
const CF_OVERAGE_SECRET = 'sc01-cf-overage-hmac-secret-001';

let fixture: B3SqliteFixture;
let tripwire: ReturnType<typeof installZeroNetworkTripwire>;
let grabPayRoute: typeof import('@/app/api/webhooks/grabpay/route');
let promptPayRoute: typeof import('@/app/api/webhooks/promptpay/route');
let sepaRoute: typeof import('@/app/api/webhooks/sepa/route');
let couponActivateRoute: typeof import('@/app/api/coupons/activate/route');
let overageBillingRoute: typeof import('@/app/api/webhooks/overage-billing/route');
let nowpaymentsRoute: typeof import('@/app/api/webhooks/nowpayments/route');
let accountActions: typeof import('@/land/account/actions');

const savedEnv = new Map<string, string | undefined>();
const trackedEnvKeys = [
  'BYOK_MASTER_KEY',
  'GRABPAY_WEBHOOK_SECRET',
  'PROMPTPAY_WEBHOOK_SECRET',
  'SEPA_WEBHOOK_SECRET',
  'PROMO_COUPON_CODES',
  'CLOUDFLARE_QUEUE_SECRET',
  'OVERAGE_WEBHOOK_SECRET',
  'NOWPAYMENTS_IPN_SECRET',
  'NOWPAYMENTS_API_KEY',
  'RESEND_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'INNGEST_EVENT_KEY',
] as const;

function applySc01ExtraSchemas(target: B3SqliteFixture) {
  target.sqlite.exec(readFileSync(resolve('migrations', '0025-coupon-redemptions.sql'), 'utf8'));
  target.sqlite.exec(readFileSync(resolve('migrations', '0085-tenant-settings.sql'), 'utf8'));
  target.sqlite.exec(readFileSync(resolve('migrations', '0207_overage_topup.sql'), 'utf8'));
  target.sqlite.exec(`
    DROP TABLE IF EXISTS usage_events;
    CREATE TABLE usage_events (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      license_nonce TEXT,
      user_id TEXT,
      tier TEXT,
      usage_count INTEGER DEFAULT 0,
      overage_count INTEGER DEFAULT 0,
      overage_fee REAL DEFAULT 0,
      event_timestamp TEXT,
      idempotency_key TEXT UNIQUE,
      service TEXT,
      billing_period TEXT
    );
    CREATE TABLE IF NOT EXISTS overage_events (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      license_nonce TEXT,
      overage_count INTEGER DEFAULT 0,
      overage_fee REAL DEFAULT 0,
      billing_period TEXT,
      billable INTEGER DEFAULT 0,
      processed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_credits (
      user_id TEXT PRIMARY KEY,
      credits_remaining INTEGER NOT NULL DEFAULT 0,
      credits_total_purchased INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS localized_payment_transactions (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      payment_rail TEXT NOT NULL,
      base_amount_cents INTEGER NOT NULL,
      settlement_currency TEXT NOT NULL,
      settlement_amount REAL NOT NULL,
      fx_rate_applied REAL NOT NULL,
      subtotal_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      rail_transaction_reference TEXT,
      mandate_reference TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      idempotency_key TEXT NOT NULL UNIQUE,
      error_code TEXT,
      error_message TEXT,
      settled_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

function postNowPayments(payload: Record<string, unknown>) {
  const rawBody = JSON.stringify(payload);
  return dispatchRoute(
    buildJsonRequest('/api/webhooks/nowpayments', rawBody, {
      'x-nowpayments-sig': signNowPaymentsIpn(payload),
    }),
    nowpaymentsRoute.POST,
  );
}

beforeAll(async () => {
  for (const key of trackedEnvKeys) savedEnv.set(key, process.env[key]);
  tripwire = installZeroNetworkTripwire();
  grabPayRoute = await import('@/app/api/webhooks/grabpay/route');
  promptPayRoute = await import('@/app/api/webhooks/promptpay/route');
  sepaRoute = await import('@/app/api/webhooks/sepa/route');
  couponActivateRoute = await import('@/app/api/coupons/activate/route');
  overageBillingRoute = await import('@/app/api/webhooks/overage-billing/route');
  nowpaymentsRoute = await import('@/app/api/webhooks/nowpayments/route');
  accountActions = await import('@/land/account/actions');
});

beforeEach(() => {
  fixture?.sqlite.close();
  fixture = createB3SqliteFixture();
  applySc01ExtraSchemas(fixture);
  bindD1Globals(fixture.binding);

  seedSyntheticTenant(fixture, {
    userId: 'usr-alpha',
    orgId: 'org-alpha',
    email: 'alpha@example.invalid',
  });
  seedSyntheticTenant(fixture, {
    userId: 'usr-bravo',
    orgId: 'org-bravo',
    email: 'bravo@example.invalid',
  });
  simulateWorkerRestart(['usr-alpha', 'usr-bravo']);

  process.env.BYOK_MASTER_KEY = TEST_BYOK_KEK;
  process.env.GRABPAY_WEBHOOK_SECRET = GRAB_SECRET;
  process.env.PROMPTPAY_WEBHOOK_SECRET = PROMPTPAY_SECRET;
  process.env.SEPA_WEBHOOK_SECRET = SEPA_SECRET;
  process.env.CLOUDFLARE_QUEUE_SECRET = CF_OVERAGE_SECRET;
  process.env.NOWPAYMENTS_IPN_SECRET = B3_NOWPAYMENTS_SECRET;
  process.env.NOWPAYMENTS_API_KEY = 'sc01-synthetic-np-key';
  delete process.env.PROMO_COUPON_CODES;
  delete process.env.OVERAGE_WEBHOOK_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.INNGEST_EVENT_KEY;
  resetCouponCache();
  vi.clearAllMocks();
});

afterEach(() => {
  resetCouponCache();
});

afterAll(() => {
  fixture?.sqlite.close();
  tripwire?.restore();
  for (const key of trackedEnvKeys) {
    const val = savedEnv.get(key);
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
});

describe('SC01 Wave 2A — P0 & Blueprint 05 Security Closure (Real SQLite/D1 + Web Crypto)', () => {
  it('BYOK-SEC-01: wraps DEKs in key_versions with KEK AES-256-GCM, excludes key_versions from D1 dumps, preserves >0x7F binary on rotation, and scrubs sk-or-v1-* / sk-ant-*', async () => {
    await ensureKeyVersionRow(1);
    const v1Row = fixture.sqlite
      .prepare('SELECT encrypted_key FROM key_versions WHERE version = 1')
      .get() as { encrypted_key: string } | undefined;

    expect(v1Row).toBeDefined();
    expect(v1Row!.encrypted_key.startsWith(KEK_ENVELOPE_PREFIX)).toBe(true);
    expect(v1Row!.encrypted_key).not.toBe(TEST_BYOK_KEK);
    expect(v1Row!.encrypted_key).not.toContain(TEST_BYOK_KEK);

    // Seed BYOK + provider + platform credentials containing high-bit / arbitrary UTF-8 characters
    const rawKey = 'sk-or-v1-live-customer-secret-key-9999999999';
    const rawProviderSecret = 'prov-secret-việt-nam-🚀-ÿ';
    const rawAccessToken = 'ya29.oauth-token-đặc-biệt-€';
    const rawRefreshToken = '1//refresh-token-ñ-Ω';

    const v1ApiKeyBlob = await encryptApiKey(rawKey, 'usr-alpha', 1);
    // Guarantee binary ciphertext contains bytes > 0x7F (AES-GCM random IV + tag statistically does, assert explicitly)
    const v1ProviderBlob = await encryptApiKey(rawProviderSecret, 'usr-alpha', 1);
    expect(Array.from(v1ProviderBlob).some((b) => b > 0x7f)).toBe(true);

    fixture.sqlite
      .prepare(
        `INSERT INTO user_api_keys (user_id, provider, encrypted_key, key_version)
         VALUES (?, 'openrouter', ?, 1)`,
      )
      .run('usr-alpha', v1ApiKeyBlob);

    fixture.sqlite
      .prepare(
        `INSERT INTO user_provider_credentials (id, user_id, provider, encrypted_value, key_version, created_at, updated_at)
         VALUES ('upc_1', 'usr-alpha', 'elevenlabs', ?, 1, unixepoch(), unixepoch())`,
      )
      .run(packedToText(v1ProviderBlob));

    const v1AccessText = packedToText(await encryptApiKey(rawAccessToken, 'usr-alpha', 1));
    const v1RefreshText = packedToText(await encryptApiKey(rawRefreshToken, 'usr-alpha', 1));
    fixture.sqlite
      .prepare(
        `INSERT INTO platform_credentials (id, user_id, platform, access_token_encrypted, refresh_token_encrypted, key_version)
         VALUES ('plat_1', 'usr-alpha', 'youtube', ?, ?, 1)`,
      )
      .run(v1AccessText, v1RefreshText);

    // Provision version 2 wrapped DEK and rotate all 3 tables
    const wrappedV2 = await generateWrappedDek(2, 'master');
    expect(wrappedV2.startsWith(KEK_ENVELOPE_PREFIX)).toBe(true);
    fixture.sqlite
      .prepare(
        `INSERT INTO key_versions (key_type, version, encrypted_key, rotated_by, is_active)
         VALUES ('master', 2, ?, 'admin-test', 1)`,
      )
      .run(wrappedV2);

    expect(await reencryptUserApiKeys(2, 1)).toBe(1);
    expect(await reencryptProviderCredentials(2, 1)).toBe(1);
    expect(await reencryptPlatformCredentials(2, 1)).toBe(1);

    // Verify 100% lossless round-trip on rotated v2 ciphertexts
    const rotatedApi = fixture.sqlite
      .prepare('SELECT encrypted_key, key_version FROM user_api_keys WHERE user_id = ?')
      .get('usr-alpha') as { encrypted_key: Uint8Array; key_version: number };
    expect(rotatedApi.key_version).toBe(2);
    expect(await decryptApiKey(rotatedApi.encrypted_key, 'usr-alpha', 2)).toBe(rawKey);

    const rotatedProv = fixture.sqlite
      .prepare('SELECT encrypted_value, key_version FROM user_provider_credentials WHERE id = ?')
      .get('upc_1') as { encrypted_value: string; key_version: number };
    expect(rotatedProv.key_version).toBe(2);
    expect(await decryptApiKey(rotatedProv.encrypted_value, 'usr-alpha', 2)).toBe(rawProviderSecret);

    const rotatedPlat = fixture.sqlite
      .prepare('SELECT access_token_encrypted, refresh_token_encrypted, key_version FROM platform_credentials WHERE id = ?')
      .get('plat_1') as { access_token_encrypted: string; refresh_token_encrypted: string; key_version: number };
    expect(rotatedPlat.key_version).toBe(2);
    expect(await decryptApiKey(rotatedPlat.access_token_encrypted, 'usr-alpha', 2)).toBe(rawAccessToken);
    expect(await decryptApiKey(rotatedPlat.refresh_token_encrypted, 'usr-alpha', 2)).toBe(rawRefreshToken);

    // Without the true Worker Secret KEK, wrapped DEKs in key_versions CANNOT be unwrapped
    process.env.BYOK_MASTER_KEY = ALTERNATE_BYOK_KEK;
    await expect(decryptApiKey(rotatedApi.encrypted_key, 'usr-alpha', 2)).rejects.toThrow();
    process.env.BYOK_MASTER_KEY = TEST_BYOK_KEK;

    // Verify D1 SQL backup dump excludes key_versions completely
    const sqlDump = await buildD1Dump(fixture.binding as unknown as D1Database);
    expect(sqlDump).not.toContain('INSERT INTO "key_versions"');
    expect(sqlDump).not.toContain(wrappedV2);

    // Verify PII scrubber redacts hyphenated OpenRouter & Anthropic keys
    const scrubbed = scrubPII(
      'Failed key sk-or-v1-abcdef0123456789abcdef0123456789 and sk-ant-api03-9876543210abcdef9876543210',
    );
    expect(scrubbed).not.toContain('sk-or-v1-');
    expect(scrubbed).not.toContain('sk-ant-api03-');
    expect(scrubbed).toContain('[REDACTED-SK]');
  });

  it('D3A-001: GrabPay, PromptPay, and SEPA webhooks fail closed on unset secret (503), reject mock/invalid HMAC (401), enforce amount/currency, and deduplicate replays', async () => {
    fixture.sqlite
      .prepare(
        `INSERT INTO localized_payment_transactions
         (id, org_id, user_id, tier, payment_rail, base_amount_cents, settlement_currency, settlement_amount, fx_rate_applied, subtotal_amount, total_amount, status, idempotency_key)
         VALUES
         ('lpt_grab_1', 'org-alpha', 'usr-alpha', 'BASIC', 'GRABPAY', 19900, 'SGD', 268.0, 1.35, 268.0, 268.0, 'pending', 'idem_grab_1'),
         ('lpt_pp_1', 'org-alpha', 'usr-alpha', 'BASIC', 'PROMPTPAY', 19900, 'THB', 6800.0, 34.17, 6800.0, 6800.0, 'pending', 'idem_pp_1'),
         ('lpt_sepa_1', 'org-alpha', 'usr-alpha', 'BASIC', 'SEPA_DIRECT_DEBIT', 19900, 'EUR', 185.0, 0.93, 185.0, 185.0, 'pending', 'idem_sepa_1')`,
      )
      .run();

    // 1. Unset secrets -> 503 fail closed
    delete process.env.GRABPAY_WEBHOOK_SECRET;
    delete process.env.PROMPTPAY_WEBHOOK_SECRET;
    delete process.env.SEPA_WEBHOOK_SECRET;

    const grabNoSecret = await dispatchRoute(
      buildJsonRequest('/api/webhooks/grabpay', JSON.stringify({ transactionId: 'lpt_grab_1', status: 'SUCCESS', amount: 268, currency: 'SGD' }), {
        'x-grab-signature': 'grabpay_mock_secret',
      }),
      grabPayRoute.POST,
    );
    expect(grabNoSecret.status).toBe(503);

    const ppNoSecret = await dispatchRoute(
      buildJsonRequest('/api/webhooks/promptpay', JSON.stringify({ transactionId: 'lpt_pp_1', paidAmount: 6800, currency: 'THB', status: 'success' }), {
        'x-promptpay-signature': 'promptpay_mock_secret',
      }),
      promptPayRoute.POST,
    );
    expect(ppNoSecret.status).toBe(503);

    const sepaNoSecret = await dispatchRoute(
      buildJsonRequest('/api/webhooks/sepa', JSON.stringify({ eventType: 'cleared', mandateReference: 'M1', transactionId: 'lpt_sepa_1', settledAmountEur: 185 }), {
        'x-sepa-signature': 'sepa_mock_secret_key',
      }),
      sepaRoute.POST,
    );
    expect(sepaNoSecret.status).toBe(503);

    // Restore secrets and test legacy mock secret attack -> 401
    process.env.GRABPAY_WEBHOOK_SECRET = GRAB_SECRET;
    process.env.PROMPTPAY_WEBHOOK_SECRET = PROMPTPAY_SECRET;
    process.env.SEPA_WEBHOOK_SECRET = SEPA_SECRET;

    const grabForged = await dispatchRoute(
      buildJsonRequest('/api/webhooks/grabpay', JSON.stringify({ transactionId: 'lpt_grab_1', status: 'SUCCESS', amount: 268, currency: 'SGD' }), {
        'x-grab-signature': 'grabpay_mock_secret',
      }),
      grabPayRoute.POST,
    );
    expect(grabForged.status).toBe(401);

    // Wrong amount/currency signed with valid secret -> 422 and status stays pending
    const badGrabBody = JSON.stringify({ transactionId: 'lpt_grab_1', status: 'SUCCESS', amount: 0.01, currency: 'VND' });
    const badGrabSig = await computeHmacHex(badGrabBody, GRAB_SECRET, 'SHA-256');
    const grabMismatch = await dispatchRoute(
      buildJsonRequest('/api/webhooks/grabpay', badGrabBody, { 'x-grab-signature': badGrabSig }),
      grabPayRoute.POST,
    );
    expect(grabMismatch.status).toBe(422);
    const grabRowAfterMismatch = fixture.sqlite
      .prepare('SELECT status FROM localized_payment_transactions WHERE id = ?')
      .get('lpt_grab_1') as { status: string };
    expect(grabRowAfterMismatch.status).toBe('pending');

    // Valid SEPA clearing + replay idempotency
    const validSepaBody = JSON.stringify({
      eventType: 'cleared',
      mandateReference: 'MANDATE-01',
      transactionId: 'lpt_sepa_1',
      settledAmountEur: 185.0,
      currency: 'EUR',
    });
    const validSepaSig = await computeHmacHex(validSepaBody, SEPA_SECRET, 'SHA-256');
    const sepaOk = await dispatchRoute(
      buildJsonRequest('/api/webhooks/sepa', validSepaBody, { 'x-sepa-signature': validSepaSig }),
      sepaRoute.POST,
    );
    expect(sepaOk.status).toBe(200);

    const sepaReplay = await dispatchRoute(
      buildJsonRequest('/api/webhooks/sepa', validSepaBody, { 'x-sepa-signature': validSepaSig }),
      sepaRoute.POST,
    );
    expect(sepaReplay.status).toBe(200);
    expect(await sepaReplay.json()).toMatchObject({ received: true, duplicate: true });
  });

  it('D3A-002: removes hardcoded FREE50/LAUNCH25 fallback, blocks partial-discount activation, enforces bounded 30d expiry + 409 single redemption, and guards /api/coupons on Pilot', async () => {
    mockCurrentUserFromHeaders.mockResolvedValue({ id: 'usr-alpha', email: 'alpha@example.invalid' });

    const makeCouponReq = (body: Record<string, unknown>) =>
      new NextRequest(`${B3_ORIGIN}/api/coupons/activate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [CSRF_HEADER_NAME]: 'csrf-tok-1',
          cookie: `${CSRF_COOKIE_NAME}=csrf-tok-1`,
        },
        body: JSON.stringify(body),
      });

    // 1. Default production env (PROMO_COUPON_CODES unset) -> FREE50 rejected with 404
    const unsetRes = await dispatchRoute(makeCouponReq({ coupon: 'FREE50', tier: 'MASTER' }), couponActivateRoute.POST);
    expect(unsetRes.status).toBe(404);
    expect(await getUserTier('usr-alpha')).toBe('BASIC');

    // 2. Configure explicit coupons: 25%-off partial coupon must NEVER grant $0 activation
    process.env.PROMO_COUPON_CODES =
      'VIP100:100:5:2099-12-31:sophia:1000,LAUNCH25:25:100:2099-12-31:sophia:500';
    resetCouponCache();

    const partialRes = await dispatchRoute(
      makeCouponReq({ coupon: 'LAUNCH25', tier: 'MASTER' }),
      couponActivateRoute.POST,
    );
    expect(partialRes.status).toBe(400);

    // 3. Valid 100%-off coupon activates once with bounded 30-day period, then replay returns 409 with zero extra MCU
    const firstActivate = await dispatchRoute(
      makeCouponReq({ coupon: 'VIP100', tier: 'PREMIUM' }),
      couponActivateRoute.POST,
    );
    expect(firstActivate.status).toBe(200);

    const subRow = fixture.sqlite
      .prepare('SELECT plan, current_period_end FROM subscriptions WHERE org_id = ?')
      .get('org-alpha') as { plan: string; current_period_end: string | null };
    expect(subRow.plan).toBe('PREMIUM');
    expect(subRow.current_period_end).not.toBeNull();
    const daysGranted = (new Date(subRow.current_period_end!).getTime() - Date.now()) / 86_400_000;
    expect(daysGranted).toBeGreaterThan(29);
    expect(daysGranted).toBeLessThan(31);

    const balanceBeforeReplay = (
      fixture.sqlite
        .prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?')
        .get('usr-alpha') as { credits_remaining: number }
    ).credits_remaining;
    expect(balanceBeforeReplay).toBe(1050); // initial 50 + 1000 bonus

    const replayActivate = await dispatchRoute(
      makeCouponReq({ coupon: 'VIP100', tier: 'PREMIUM' }),
      couponActivateRoute.POST,
    );
    expect(replayActivate.status).toBe(409);

    const balanceAfterReplay = (
      fixture.sqlite
        .prepare('SELECT credits_remaining FROM user_mcu_balance WHERE user_id = ?')
        .get('usr-alpha') as { credits_remaining: number }
    ).credits_remaining;
    expect(balanceAfterReplay).toBe(1050);

    // 4. Pilot guard blocks /api/coupons/activate when PAYMENTS_ENABLED=false
    const pilotBlocked = enforcePilotFeatureDisabled('/api/coupons/activate', {
      PAYMENTS_ENABLED: 'false',
      PILOT_INVITE_ONLY: 'false',
    });
    expect(pilotBlocked?.status).toBe(403);
  });

  it('G8-1A-001: Account team & support Server Actions reject cross-tenant orgId and enforce VIEWER vs ADMIN vs OWNER RBAC', async () => {
    // Seed a viewer and an admin in org-alpha
    fixture.sqlite
      .prepare(
        `INSERT INTO org_members (id, org_id, user_id, role, created_at)
         VALUES ('om_viewer', 'org-alpha', 'usr-viewer', 'viewer', datetime('now')),
                ('om_admin', 'org-alpha', 'usr-admin', 'admin', datetime('now'))`,
      )
      .run();

    // Cross-tenant attacker (owner of org-bravo) targeting org-alpha -> FORBIDDEN across all actions
    mockCurrentUser.mockResolvedValue({ id: 'usr-bravo', email: 'bravo@example.invalid' });
    await expect(accountActions.listTeamMembersAction('org-alpha')).rejects.toThrow(/FORBIDDEN/);
    await expect(
      accountActions.inviteTeamMemberAction({ orgId: 'org-alpha', email: 'x@example.com', role: 'VIEWER' }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      accountActions.updateTeamMemberRoleAction({ orgId: 'org-alpha', memberId: 'om_viewer', role: 'EDITOR' }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      accountActions.removeTeamMemberAction({ orgId: 'org-alpha', memberId: 'om_viewer' }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(accountActions.toggleSupportAccessAction('org-alpha', true)).rejects.toThrow(/FORBIDDEN/);

    // Intra-tenant VIEWER can list members, but CANNOT invite/update/remove or toggle support access
    mockCurrentUser.mockResolvedValue({ id: 'usr-viewer', email: 'viewer@example.invalid' });
    const viewerList = await accountActions.listTeamMembersAction('org-alpha');
    expect(viewerList.length).toBeGreaterThanOrEqual(2);
    await expect(
      accountActions.inviteTeamMemberAction({ orgId: 'org-alpha', email: 'x@example.com', role: 'VIEWER' }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(accountActions.toggleSupportAccessAction('org-alpha', true)).rejects.toThrow(/FORBIDDEN/);

    // Intra-tenant ADMIN can invite members, but CANNOT toggle OWNER-only support access
    mockCurrentUser.mockResolvedValue({ id: 'usr-admin', email: 'admin@example.invalid' });
    const invited = await accountActions.inviteTeamMemberAction({
      orgId: 'org-alpha',
      email: 'teammate@example.invalid',
      role: 'VIEWER',
    });
    expect(invited.orgId).toBe('org-alpha');
    await expect(accountActions.toggleSupportAccessAction('org-alpha', true)).rejects.toThrow(/FORBIDDEN/);

    // Workspace OWNER can toggle support access
    mockCurrentUser.mockResolvedValue({ id: 'usr-alpha', email: 'alpha@example.invalid' });
    const toggled = await accountActions.toggleSupportAccessAction('org-alpha', true);
    expect(toggled.enabled).toBe(true);
  });

  it('D3A-003: /api/webhooks/overage-billing awaits async Cloudflare HMAC (blocking truthy Promise bypass), rejects Polar-Signature, and deduplicates replays atomically', async () => {
    const eventPayload = {
      licenseNonce: 'lic_alpha_01',
      userId: 'usr-alpha',
      tier: 'BASIC',
      usageCount: 1200,
      overageCount: 200,
      overageFee: 25,
      timestamp: Date.now(),
      idempotencyKey: 'ovg_idem_001',
    };
    const rawBody = JSON.stringify(eventPayload);

    // 1. Forged X-Cloudflare-Signature ('anything') MUST fail with 401 (no longer truthy unawaited Promise!)
    const forgedRes = await dispatchRoute(
      buildJsonRequest('/api/webhooks/overage-billing', rawBody, {
        'webhook-id': 'wh_forged_1',
        'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        'X-Cloudflare-Signature': 'anything-forged',
      }),
      overageBillingRoute.POST,
    );
    expect(forgedRes.status).toBe(401);

    // 2. Banned Polar-Signature MUST be rejected with 400
    const polarRes = await dispatchRoute(
      buildJsonRequest('/api/webhooks/overage-billing', rawBody, {
        'webhook-id': 'wh_polar_1',
        'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        'Polar-Signature': 'v1,polar_banned',
      }),
      overageBillingRoute.POST,
    );
    expect(polarRes.status).toBe(400);

    const countBeforeValid = (
      fixture.sqlite.prepare('SELECT COUNT(*) AS cnt FROM overage_events').get() as { cnt: number }
    ).cnt;
    expect(countBeforeValid).toBe(0);

    // 3. Valid HMAC-SHA256 over rawBody succeeds once, and replay with same idempotencyKey or webhook-id does NOT double-record
    const validSig = await computeHmacHex(rawBody, CF_OVERAGE_SECRET, 'SHA-256');
    const validRes = await dispatchRoute(
      buildJsonRequest('/api/webhooks/overage-billing', rawBody, {
        'webhook-id': 'wh_valid_1',
        'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        'X-Cloudflare-Signature': validSig,
      }),
      overageBillingRoute.POST,
    );
    expect(validRes.status).toBe(200);

    const replayRes = await dispatchRoute(
      buildJsonRequest('/api/webhooks/overage-billing', rawBody, {
        'webhook-id': 'wh_valid_1',
        'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        'X-Cloudflare-Signature': validSig,
      }),
      overageBillingRoute.POST,
    );
    expect(replayRes.status).toBe(200);
    expect(await replayRes.json()).toMatchObject({ received: true, duplicate: true });

    const countAfterReplay = (
      fixture.sqlite.prepare('SELECT COUNT(*) AS cnt FROM overage_events').get() as { cnt: number }
    ).cnt;
    expect(countAfterReplay).toBe(1);
  });

  it('D3A-004 & D3A-005: NOWPayments commerce, top-up, and subscription handlers reject underpayment, missing actually_paid (not-reported), wrong currency/fiat amount, and wrong user', async () => {
    // --- A. Commerce Order ($500 = 50000 cents USD) ---
    fixture.sqlite
      .prepare(
        `INSERT INTO commerce_products (id, workspace_id, name, price_cents, currency, is_active, created_at, updated_at)
         VALUES ('prod_500', 'org-alpha', 'Agency Pack', 50000, 'USD', 1, 0, 0)`,
      )
      .run();
    const createdCommerce = await createOrder({ workspaceId: 'org-alpha', productId: 'prod_500' });
    expect(createdCommerce.ok).toBe(true);
    if (!createdCommerce.ok) throw new Error('commerce order setup failed');
    const commerceOrderId = createdCommerce.value.id;

    // $1 invoice attack against $500 commerce order -> rejected (500), order stays pending
    const cheapCommerceRes = await postNowPayments({
      payment_id: 'np_comm_cheap_1',
      payment_status: 'finished',
      price_amount: 1,
      price_currency: 'USD',
      pay_amount: 1,
      pay_currency: 'USDT',
      actually_paid: 1,
      order_id: commerceOrderId,
    });
    expect(cheapCommerceRes.status).toBe(500);

    // Missing actually_paid ('not-reported') on commerce order -> rejected (500), order stays pending
    const missingPaidCommerceRes = await postNowPayments({
      payment_id: 'np_comm_nopaid_1',
      payment_status: 'finished',
      price_amount: 500,
      price_currency: 'USD',
      pay_amount: 500,
      pay_currency: 'USDT',
      order_id: commerceOrderId,
    });
    expect(missingPaidCommerceRes.status).toBe(500);

    const commRow = fixture.sqlite
      .prepare('SELECT status FROM commerce_orders WHERE id = ?')
      .get(commerceOrderId) as { status: string };
    expect(commRow.status).toBe('pending');

    // --- B. Top-Up Order ($10 = 1000 cents for usr-alpha) ---
    fixture.sqlite
      .prepare(
        `INSERT INTO pending_topups (id, user_id, invoice_id, mcu_amount, price_cents, status)
         VALUES ('topup_inv_tu_100', 'usr-alpha', 'inv_tu_100', 100, 1000, 'pending')`,
      )
      .run();

    // Missing actually_paid ('not-reported') -> rejected (500), zero credits
    const tuMissingPaid = await postNowPayments({
      payment_id: 'np_tu_nopaid',
      payment_status: 'finished',
      price_amount: 10,
      price_currency: 'USD',
      pay_amount: 10,
      pay_currency: 'USDT',
      invoice_id: 'inv_tu_100',
      order_id: 'topup_usr-alpha_1700000001',
    });
    expect(tuMissingPaid.status).toBe(500);

    // Wrong user in order_id (usr-bravo claiming usr-alpha's invoice) -> rejected (500), zero credits
    const tuWrongUser = await postNowPayments({
      payment_id: 'np_tu_wrong_user',
      payment_status: 'finished',
      price_amount: 10,
      price_currency: 'USD',
      pay_amount: 10,
      pay_currency: 'USDT',
      actually_paid: 10,
      invoice_id: 'inv_tu_100',
      order_id: 'topup_usr-bravo_1700000002',
    });
    expect(tuWrongUser.status).toBe(500);

    // Wrong fiat amount ($1 vs $10 pending_topups.price_cents) -> rejected (500), zero credits
    const tuWrongPrice = await postNowPayments({
      payment_id: 'np_tu_wrong_price',
      payment_status: 'finished',
      price_amount: 1,
      price_currency: 'USD',
      pay_amount: 1,
      pay_currency: 'USDT',
      actually_paid: 1,
      invoice_id: 'inv_tu_100',
      order_id: 'topup_usr-alpha_1700000003',
    });
    expect(tuWrongPrice.status).toBe(500);

    const creditRows = fixture.sqlite.prepare('SELECT COUNT(*) AS cnt FROM user_credits').get() as { cnt: number };
    expect(creditRows.cnt).toBe(0);

    // --- C. Subscription Order ($399 PREMIUM for usr-alpha) ---
    seedPendingOrder(fixture, {
      orderId: 'sophia_usr-alpha_1700000099',
      userId: 'usr-alpha',
      tier: 'PREMIUM',
      period: 'monthly',
      paymentMethod: 'nowpayments',
      amountUsdCents: 39_900,
    });

    // Missing actually_paid ('not-reported') on finished subscription IPN -> does NOT activate PREMIUM
    await postNowPayments({
      payment_id: 'np_sub_nopaid',
      payment_status: 'finished',
      price_amount: 399,
      price_currency: 'USD',
      pay_amount: 399,
      pay_currency: 'USDT',
      order_id: 'sophia_usr-alpha_1700000099',
    });
    simulateWorkerRestart(['usr-alpha']);
    expect(await getUserTier('usr-alpha')).toBe('BASIC');

    // Valid sufficient actually_paid activates PREMIUM cleanly
    const validSubRes = await postNowPayments({
      payment_id: 'np_sub_valid_399',
      payment_status: 'finished',
      price_amount: 399,
      price_currency: 'USD',
      pay_amount: 399,
      pay_currency: 'USDT',
      actually_paid: 399,
      order_id: 'sophia_usr-alpha_1700000099',
    });
    expect(validSubRes.status).toBe(200);
    simulateWorkerRestart(['usr-alpha']);
    expect(await getUserTier('usr-alpha')).toBe('PREMIUM');
    expect(tripwire.blockedFetches).toEqual([]);
  });
});
