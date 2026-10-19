#!/usr/bin/env node
/**
 * Live NOWPayments checkout proof. Creates a real invoice and waits for the
 * authenticated test account's paid order and tier activation. The invoice
 * must be paid by the operator outside this script.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createEvidenceRecorder } from './live-proof/evidence.mjs';
import { createRequester, parseDeploymentVersion, poll, redact } from './live-proof/runtime.mjs';

const TIERS = new Set(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']);
const PERIODS = new Set(['monthly', 'yearly', 'lifetime']);
const PRODUCTION_HOSTS = new Set(['sophia.agencyos.network', 'www.sophia.agencyos.network']);
const NOWPAYMENTS_INVOICE_HOSTS = new Set(['nowpayments.io']);
const evidence = createEvidenceRecorder(process.env.SOPHIA_PAYMENT_LIVE_EVIDENCE_PATH?.trim(), {
  schema: 'sophia-live-saas-payment-proof-v4',
});

function fail(message) {
  evidence.record('failure', 'failed', { message });
  evidence.write('failed', message);
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing required environment variable ${name}`);
  return value;
}

function positiveNumber(name) {
  const value = Number(required(name));
  if (!Number.isFinite(value) || value <= 0) fail(`${name} must be a positive number`);
  return value;
}

function hashReference(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function parseConfig() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`Usage:
  SOPHIA_PAYMENT_LIVE_CONFIRM=run-test-payment \\
  SOPHIA_PAYMENT_LIVE_BASE_URL=https://staging.example.com \\
  SOPHIA_PAYMENT_LIVE_EMAIL=test@example.com \\
  SOPHIA_PAYMENT_LIVE_PASSWORD='...' \\
  SOPHIA_PAYMENT_LIVE_TIER=BASIC \\
  SOPHIA_PAYMENT_LIVE_PERIOD=monthly \\
  SOPHIA_PAYMENT_LIVE_AMOUNT_CONFIRMED_USD=199 \\
  SOPHIA_VERSION_INTROSPECT_TOKEN='...' \\
  npm run verify:saas-payment:live

Optional:
  SOPHIA_PAYMENT_ALLOW_PRODUCTION=1
  SOPHIA_PAYMENT_TIMEOUT_SECONDS=1800
  SOPHIA_PAYMENT_POLL_INTERVAL_SECONDS=10
  SOPHIA_PAYMENT_LIVE_EVIDENCE_PATH=plans/reports/live-payment-proof.json`);
    process.exit(0);
  }

  if (required('SOPHIA_PAYMENT_LIVE_CONFIRM') !== 'run-test-payment') {
    fail('set SOPHIA_PAYMENT_LIVE_CONFIRM=run-test-payment to acknowledge a real checkout invoice');
  }

  const rawBaseUrl = required('SOPHIA_PAYMENT_LIVE_BASE_URL');
  let baseUrl;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    fail('SOPHIA_PAYMENT_LIVE_BASE_URL must be an absolute URL');
  }
  const localHttp = baseUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(baseUrl.hostname);
  if (baseUrl.protocol !== 'https:' && !localHttp) fail('payment proof target must use HTTPS');
  const hostname = baseUrl.hostname.toLowerCase().replace(/\.$/, '');
  if (PRODUCTION_HOSTS.has(hostname) && process.env.SOPHIA_PAYMENT_ALLOW_PRODUCTION !== '1') {
    fail('production target requires SOPHIA_PAYMENT_ALLOW_PRODUCTION=1');
  }

  const tier = required('SOPHIA_PAYMENT_LIVE_TIER').toUpperCase();
  if (!TIERS.has(tier)) fail('SOPHIA_PAYMENT_LIVE_TIER must be BASIC, PREMIUM, ENTERPRISE, or MASTER');
  const defaultPeriod = tier === 'MASTER' ? 'lifetime' : 'monthly';
  const period = (process.env.SOPHIA_PAYMENT_LIVE_PERIOD?.trim() || defaultPeriod).toLowerCase();
  if (!PERIODS.has(period)) fail('SOPHIA_PAYMENT_LIVE_PERIOD must be monthly, yearly, or lifetime');
  if ((tier === 'MASTER') !== (period === 'lifetime')) fail('MASTER must use lifetime billing; other tiers cannot use lifetime billing');

  const timeoutSeconds = Number(process.env.SOPHIA_PAYMENT_TIMEOUT_SECONDS ?? '1800');
  const pollSeconds = Number(process.env.SOPHIA_PAYMENT_POLL_INTERVAL_SECONDS ?? '10');
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) fail('SOPHIA_PAYMENT_TIMEOUT_SECONDS must be positive');
  if (!Number.isFinite(pollSeconds) || pollSeconds <= 0) fail('SOPHIA_PAYMENT_POLL_INTERVAL_SECONDS must be positive');

  return {
    baseUrl,
    email: required('SOPHIA_PAYMENT_LIVE_EMAIL'),
    password: required('SOPHIA_PAYMENT_LIVE_PASSWORD'),
    tier,
    period,
    amountConfirmedUsd: positiveNumber('SOPHIA_PAYMENT_LIVE_AMOUNT_CONFIRMED_USD'),
    timeoutMs: timeoutSeconds * 1000,
    pollIntervalMs: pollSeconds * 1000,
  };
}

const config = parseConfig();
const runId = randomUUID();
Object.assign(evidence.context, {
  runId,
  baseUrl: config.baseUrl.origin,
  provider: 'nowpayments',
  tier: config.tier,
  period: config.period,
  amountConfirmedUsd: config.amountConfirmedUsd,
});
const startedAt = Date.now();
evidence.record('start', 'running', { runId, provider: 'nowpayments', tier: config.tier, period: config.period });

const { request, cookieCount } = createRequester(config.baseUrl, fail);
const version = await request('/api/version', {
  label: 'deployment version',
  headers: { authorization: `Bearer ${required('SOPHIA_VERSION_INTROSPECT_TOKEN')}` },
});
evidence.context.deployment = parseDeploymentVersion(version, fail);
const shortSha = evidence.context.deployment.shortSha;
evidence.record('deployment-version', 'passed', evidence.context.deployment);

await request('/api/auth/sign-in/email', {
  label: 'sign in',
  method: 'POST',
  body: { email: config.email, password: config.password },
});
if (cookieCount() === 0) fail('sign in succeeded but produced no auth cookies');
evidence.record('sign-in', 'passed', { cookieCount: cookieCount() });
const authenticatedSession = await request('/api/auth/session', { label: 'verify authenticated principal' });
if (authenticatedSession.authenticated !== true || typeof authenticatedSession.user?.id !== 'string') {
  fail('authenticated session did not return a stable user identity');
}
evidence.context.accountRefHash = hashReference(authenticatedSession.user.id);
evidence.record('authenticated-principal', 'passed', { accountRefHash: evidence.context.accountRefHash });
await request('/api/health', { label: 'seed csrf token' });

const checkout = await request('/api/checkout', {
  label: 'create NOWPayments checkout',
  method: 'POST',
  body: { tier: config.tier, period: config.period, paymentMethod: 'nowpayments' },
});
if (checkout.deduped === true) fail('checkout reused an existing pending order; use a clean test account or resolve its prior order');
if (typeof checkout.orderId !== 'string' || !checkout.orderId.startsWith('sophia_')) fail('checkout did not return a valid orderId');
let invoiceUrl;
try {
  invoiceUrl = new URL(checkout.url);
} catch {
  fail('checkout did not return a valid invoice URL');
}
const invoiceHostname = invoiceUrl.hostname.toLowerCase().replace(/\.$/, '');
if (invoiceUrl.protocol !== 'https:' || invoiceUrl.username || invoiceUrl.password ||
    (invoiceUrl.port && invoiceUrl.port !== '443') || !NOWPAYMENTS_INVOICE_HOSTS.has(invoiceHostname)) {
  fail('checkout invoice URL is not on an approved NOWPayments HTTPS host');
}

evidence.context.orderRefHash = hashReference(checkout.orderId);
evidence.record('checkout-created', 'passed', {
  provider: 'nowpayments',
  tier: config.tier,
  period: config.period,
  newOrder: true,
  orderRefHash: evidence.context.orderRefHash,
  invoiceHost: invoiceHostname,
  amountConfirmedUsd: config.amountConfirmedUsd,
});
evidence.write('awaiting-payment', 'Invoice created; waiting for payment and tier activation.');
console.log(`Invoice created for ${config.tier}/${config.period}, amount confirmed by operator: $${config.amountConfirmedUsd.toFixed(2)} USD.`);
console.log(`Pay this test invoice outside the script: ${checkout.url}`);

const completedOrder = await poll(
  'payment completion',
  config.timeoutMs,
  config.pollIntervalMs,
  async () => {
    const order = await request(`/api/checkout/status?orderId=${encodeURIComponent(checkout.orderId)}`, {
      label: 'poll checkout status',
    });
    if (['failed', 'expired', 'refunded', 'cancelled'].includes(order.status)) {
      fail(`test invoice reached terminal status ${order.status}`);
    }
    return {
      done: order.status === 'completed',
      value: order,
    };
  },
  fail,
);

if (completedOrder.tier !== config.tier) fail(`paid order tier mismatch: expected ${config.tier}, received ${completedOrder.tier ?? 'missing'}`);
if (completedOrder.period !== config.period) fail(`paid order period mismatch: expected ${config.period}, received ${completedOrder.period ?? 'missing'}`);
if (typeof completedOrder.paymentId !== 'string' || completedOrder.paymentId.length === 0) fail('completed order has no paymentId');
const serverPaymentCompletedAt = Date.parse(completedOrder.completedAt ?? '');
if (!Number.isFinite(serverPaymentCompletedAt)) fail('completed order is missing a server completion timestamp');
evidence.context.serverPaymentCompletedAt = new Date(serverPaymentCompletedAt).toISOString();
evidence.context.paymentRefHash = hashReference(completedOrder.paymentId);
evidence.record('payment-completed', 'passed', {
  status: completedOrder.status,
  tier: completedOrder.tier,
  period: completedOrder.period,
  paymentRefHash: evidence.context.paymentRefHash,
  serverCompletedAt: evidence.context.serverPaymentCompletedAt,
  elapsedMs: Date.now() - startedAt,
});

const runtimeStatus = await request('/api/open-core/status', { label: 'verify activated account tier' });
if (runtimeStatus.userTier !== config.tier) fail(`account tier mismatch after payment: expected ${config.tier}, received ${runtimeStatus.userTier ?? 'missing'}`);
evidence.record('tier-activated', 'passed', { userTier: runtimeStatus.userTier });
evidence.record('completed', 'passed', { elapsedMs: Date.now() - startedAt });
evidence.write('passed', 'NOWPayments checkout completed and activated the expected tier.');
console.log(`\nLIVE PAYMENT PROOF PASS: tier ${config.tier} activated at deployment ${shortSha}.`);
