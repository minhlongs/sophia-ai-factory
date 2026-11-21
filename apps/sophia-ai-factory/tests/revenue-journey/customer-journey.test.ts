import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createSqliteFixture, migrations } from './sqlite-fixture';
import { inRequest } from './request-context';
import { NextRequest, NextResponse } from 'next/server';

const origin = 'https://sophia.agencyos.network';
const customerKey = `sk-or-v1-${'a'.repeat(64)}`;
const checksumKey = 'journey-synthetic-checksum-key';
const calls: string[] = [];
const blockedFetches: string[] = [];
const evidence: Record<string, unknown> = { scope: 'partial composed boundaries; never overall PASS', migrations };
let fixture: ReturnType<typeof createSqliteFixture>;
let authRoute: typeof import('@/app/api/auth/[...all]/route');
let byokRoute: typeof import('@/app/api/user/byok/route');
let scriptsRoute: typeof import('@/app/api/scripts/generate/route');
let webhook: typeof import('@/app/api/webhooks/payos/route');
let middleware: typeof import('@/middleware');
let cookie = '';
let buyerId = '';
const originalFetch = globalThis.fetch;
const environmentNames = [
  'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'BYOK_MASTER_KEY', 'FEATURE_PAYOS',
  'PAYOS_CHECKSUM_KEY', 'RESEND_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY',
  'TELEGRAM_BOT_TOKEN', 'FOUNDER_EMAIL', 'ADMIN_EMAIL',
] as const;
const originalEnvironment = new Map(environmentNames.map(name => [name, process.env[name]]));
const runtimeGlobals = globalThis as Record<string, unknown>;
const originalBindings = new Map(['__env__', '__D1_DB'].map(name => [name, {
  present: Object.hasOwn(runtimeGlobals, name), value: runtimeGlobals[name],
}]));

function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${origin}${path}`, {
    method, headers: { origin, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function dispatch<T>(req: NextRequest, handler: (req: NextRequest) => Promise<T>) {
  return inRequest(req, () => handler(req));
}
function rows(table: string) { return fixture.sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]; }

beforeAll(async () => {
  Object.assign(process.env, {
    BETTER_AUTH_SECRET: 'journey-synthetic-auth-secret-0123456789', BETTER_AUTH_URL: origin,
    BYOK_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'), FEATURE_PAYOS: 'true',
    PAYOS_CHECKSUM_KEY: checksumKey, RESEND_API_KEY: 're_journey_synthetic',
  });
  for (const name of ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'TELEGRAM_BOT_TOKEN', 'FOUNDER_EMAIL', 'ADMIN_EMAIL']) delete process.env[name];
  fixture = createSqliteFixture();
  Object.assign(globalThis, { __env__: { DB: fixture.binding }, __D1_DB: fixture.binding });
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    calls.push(`${method} ${url}`);
    if (url === 'https://api.resend.com/emails' && method === 'POST') return Response.json({ id: 'synthetic-email' });
    if (url === 'https://openrouter.ai/api/v1/auth/key' && method === 'GET') {
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${customerKey}`);
      return Response.json({ data: { limit_remaining: 10 } });
    }
    if (url === 'https://openrouter.ai/api/v1/chat/completions' && method === 'POST') {
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${customerKey}`);
      return Response.json({ choices: [{ message: { content: JSON.stringify({ title: 'Synthetic owned topic', total_duration: 30, scenes: [
        { narration: 'Synthetic hook', duration: 10 }, { narration: 'Synthetic body', duration: 10 }, { narration: 'Synthetic CTA', duration: 10 },
      ] }) } }] });
    }
    blockedFetches.push(`${method} ${url}`);
    throw new Error(`Outbound transport denied: ${new URL(url).hostname}`);
  };
  authRoute = await import('@/app/api/auth/[...all]/route');
  byokRoute = await import('@/app/api/user/byok/route');
  scriptsRoute = await import('@/app/api/scripts/generate/route');
  webhook = await import('@/app/api/webhooks/payos/route');
  middleware = await import('@/middleware');
});

afterAll(() => {
  evidence.externalCalls = calls;
  evidence.blockedFetches = blockedFetches;
  evidence.sqlErrors = fixture?.errors ?? [];
  writeFileSync('/tmp/sophia-closure-journey-boundaries.json', JSON.stringify(evidence, null, 2));
  fixture?.sqlite.close();
  globalThis.fetch = originalFetch;
  for (const [name, value] of originalEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  for (const [name, original] of originalBindings) {
    if (original.present) runtimeGlobals[name] = original.value;
    else delete runtimeGlobals[name];
  }
});

describe.sequential('real customer boundaries with isolated SQLite and provider transports', () => {
  it('uses a true atomic batch and rejects unknown SQL', async () => {
    await expect(fixture.binding.batch([
      fixture.binding.prepare("INSERT INTO organizations(id,name) VALUES ('rollback-proof','Rollback')"),
      fixture.binding.prepare('INSERT INTO missing_journey_table(id) VALUES (1)'),
    ])).rejects.toThrow();
    expect(fixture.sqlite.prepare("SELECT * FROM organizations WHERE id='rollback-proof'").get()).toBeUndefined();
    fixture.errors.length = 0; // expected fault injection, retained separately in evidence
    evidence.atomicBatch = 'second statement failure rolled back first statement';
  });

  it('signs up through real Better Auth and resolves its secure session cookie', async () => {
    const req = request('/api/auth/sign-up/email', 'POST', { name: 'Synthetic Buyer', email: 'journey-buyer@example.invalid', password: 'SyntheticPassword123!' });
    const response = await dispatch(req, authRoute.POST);
    expect(response.status, await response.clone().text()).toBe(200);
    const body = await response.json() as { user: { id: string } };
    buyerId = body.user.id;
    const cookies = response.headers.getSetCookie();
    expect(cookies.some(value => value.includes('Secure') && value.includes('HttpOnly'))).toBe(true);
    cookie = cookies.map(value => value.split(';')[0]).join('; ');
    const session = await dispatch(request('/api/auth/get-session'), authRoute.GET);
    expect(session.status).toBe(200);
    expect((await session.json() as { user: { id: string } }).user.id).toBe(buyerId);
    expect(rows('org_members')).toHaveLength(1);
    expect(rows('subscriptions')[0]).toMatchObject({ user_id: buyerId, tier: 'BASIC' });
    expect(rows('user_mcu_balance')[0]).toMatchObject({ user_id: buyerId, credits_remaining: 50 });
    evidence.signup = { realSession: true, secureCookie: true, provisionedOrg: true, bonusMcu: 50 };
  });

  it('runs actual middleware CSRF before the authenticated BYOK route', async () => {
    const seed = await dispatch(request('/api/user/byok'), middleware.proxy);
    expect(seed.status, await seed.clone().text()).toBe(200);
    const token = seed.headers.getSetCookie().find(value => value.startsWith('csrf-token='))?.split(';')[0].slice('csrf-token='.length);
    expect(token).toBeTruthy();
    cookie += `; csrf-token=${token}`;
    for (const header of [undefined, 'wrong']) {
      const denied = await dispatch(request('/api/user/byok', 'POST', { provider: 'openrouter', key: customerKey, validateLive: true }, header ? { 'x-csrf-token': header } : {}), middleware.proxy);
      expect(denied.status).toBe(403);
    }
    const req = request('/api/user/byok', 'POST', { provider: 'openrouter', key: customerKey, validateLive: true }, { 'x-csrf-token': token! });
    const gate = await dispatch(req, middleware.proxy);
    expect(gate.status, await gate.clone().text()).toBe(200);
    const response = await dispatch(req, byokRoute.POST);
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, receipt: { provider: 'openrouter' } });
    const stored = rows('user_api_keys')[0];
    expect(stored.user_id).toBe(buyerId);
    expect(Buffer.from(stored.encrypted_key as Uint8Array).toString()).not.toContain(customerKey);
    const { lookupUserApiKey } = await import('@/tree/byok/user-api-key-store');
    expect(await lookupUserApiKey(buyerId, 'openrouter')).toEqual({ status: 'FOUND', key: customerKey });
    expect(stored.last_receipt_json).toBeNull();
    evidence.byok = { actualProbeTransport: true, encryptedAtRest: true, csrf: ['missing403', 'wrong403', 'valid200'], receiptPersisted: false };
  });

  it('rejects automated PayOS pilot_14d webhooks for manual review and activates a correlated signed standard PayOS purchase once', async () => {
    expect(buyerId).toBeTruthy();
    const purchasedBefore = Number(rows('user_mcu_balance')[0].credits_total_purchased);
    const { payOsCanonicalize } = await import('@/land/payments/payos-gateway/checksum-verifier');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(checksumKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signPayload = async (body: Record<string, unknown>) =>
      Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payOsCanonicalize(JSON.stringify(body))))).toString('hex');

    // Negative boundary: PayOS pilot_14d webhooks must fail closed for manual review without granting entitlements.
    fixture.sqlite.prepare(`INSERT INTO pending_orders(order_id,user_id,tier,period,payment_method,amount_usd_cents,amount_vnd,provider_payment_id,provider_order_code,status) VALUES (?,?,'BASIC','pilot_14d','payos',7900,1990000,'journey-pilot-link',880010,'pending')`).run('journey-pilot-order', buyerId);
    const pilotPayload = { code: '00', desc: 'success', success: true, data: { orderCode: 880010, amount: 1990000, description: 'Sophia pilot', accountNumber: 'synthetic', reference: 'synthetic', transactionDateTime: '2026-11-17 00:00:00', currency: 'VND', paymentLinkId: 'journey-pilot-link', code: '00', desc: 'success' } };
    const pilotSignature = await signPayload(pilotPayload);
    const pilotRes = await dispatch(request('/api/webhooks/payos', 'POST', { ...pilotPayload, signature: pilotSignature }), webhook.POST);
    expect(pilotRes.status, await pilotRes.clone().text()).toBe(409);
    await expect(pilotRes.json()).resolves.toMatchObject({ error: expect.stringContaining('manual review') });
    expect(rows('user_mcu_balance')[0]).toMatchObject({ credits_remaining: 50, credits_total_purchased: purchasedBefore });
    expect(fixture.sqlite.prepare('SELECT status FROM pending_orders WHERE order_id = ?').get('journey-pilot-order')).toEqual({ status: 'pending' });

    // Positive boundary: standard non-pilot BASIC monthly PayOS purchase activates once and replays idempotently.
    // Provider checkout creation is outside this boundary; explicit pending-order fixture.
    fixture.sqlite.prepare(`INSERT INTO pending_orders(order_id,user_id,tier,period,payment_method,amount_usd_cents,amount_vnd,provider_payment_id,provider_order_code,status) VALUES (?,?,'BASIC','monthly','payos',19900,4975000,'journey-link',880011,'pending')`).run('journey-order', buyerId);
    const payload = { code: '00', desc: 'success', success: true, data: { orderCode: 880011, amount: 4975000, description: 'Sophia BASIC monthly', accountNumber: 'synthetic', reference: 'synthetic', transactionDateTime: '2026-11-17 00:00:00', currency: 'VND', paymentLinkId: 'journey-link', code: '00', desc: 'success' } };
    const signature = await signPayload(payload);
    const invalid = await dispatch(request('/api/webhooks/payos', 'POST', { ...payload, signature: '0'.repeat(64) }), webhook.POST);
    expect(invalid.status).toBe(400);
    const req = request('/api/webhooks/payos', 'POST', { ...payload, signature });
    expect((await dispatch(request('/api/webhooks/payos', 'POST', { ...payload, signature }), middleware.proxy)).status).toBe(200);
    const paid = await dispatch(req, webhook.POST);
    expect(paid.status, await paid.clone().text()).toBe(200);
    const subscription = rows('subscriptions')[0];
    expect(Date.parse(subscription.current_period_end as string) - Date.parse(subscription.current_period_start as string)).toBe(30 * 86400000);
    expect(rows('user_mcu_balance')[0]).toMatchObject({ credits_remaining: 1050, credits_total_purchased: purchasedBefore + 1000 });
    const replay = await dispatch(request('/api/webhooks/payos', 'POST', { ...payload, signature }), webhook.POST);
    expect(await replay.json()).toMatchObject({ duplicate: true });
    expect(rows('user_mcu_balance')[0].credits_remaining).toBe(1050);
    evidence.payment = { pendingOrder: 'fixture; checkout not composed', pilotWebhookBlocked409: true, signedWebhook: true, replayIdempotent: true, monthlyDays: 30, purchaseMcu: 1000 };
  });

  it('generates through the actual script handler and records missing debit and durability', async () => {
    const before = rows('user_mcu_balance')[0].credits_remaining;
    const response = await dispatch(request('/api/scripts/generate', 'POST', { topic: 'Synthetic owned topic', audience: 'Synthetic audience', durationSec: 30 }), scriptsRoute.POST);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ requestId: expect.any(String), content: { hook: 'Synthetic hook', body: 'Synthetic body', cta: 'Synthetic CTA' }, metadata: { tier: 'BASIC' } });
    expect(rows('user_mcu_balance')[0].credits_remaining).toBe(before);
    expect(rows('agent_runs')).toHaveLength(0);
    expect(rows('user_api_keys')[0].last_receipt_json).toBeNull();
    evidence.script = { actualHandler: true, actualStoredCustomerKey: true, providerHttpOnlyReplaced: true, mcuDebit: false, durableScript: false, receiptConsumed: false };
  });

  it('denies anonymous script access and prevents another real session using buyer keys', async () => {
    const buyerCookie = cookie;
    cookie = '';
    expect((await dispatch(request('/api/scripts/generate', 'POST', { topic: 'Synthetic', audience: 'Synthetic' }), scriptsRoute.POST)).status).toBe(401);
    const signup = await dispatch(request('/api/auth/sign-up/email', 'POST', { name: 'Synthetic Other', email: 'journey-other@example.invalid', password: 'SyntheticPassword123!' }), authRoute.POST);
    expect(signup.status).toBe(200);
    cookie = signup.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const before = calls.filter(value => value.includes('/chat/completions')).length;
    const other = await dispatch(request('/api/scripts/generate', 'POST', { topic: 'Synthetic', audience: 'Synthetic', userId: buyerId }), scriptsRoute.POST);
    expect(other.status).toBe(422);
    expect(await other.json()).toMatchObject({ code: 'OPENROUTER_KEY_REQUIRED' });
    expect(calls.filter(value => value.includes('/chat/completions'))).toHaveLength(before);
    expect(await dispatch(request('/api/user/byok'), byokRoute.GET).then(response => response.json())).toEqual({ providers: [] });
    cookie = buyerCookie;
    evidence.tenant = { anonymous401: true, secondSessionCannotUseBuyerKey: true, secondSessionProviderListEmpty: true };
    expect(blockedFetches).toEqual([]);
  });
});
