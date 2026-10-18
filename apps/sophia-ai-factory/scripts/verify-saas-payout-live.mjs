#!/usr/bin/env node
/** Read-only proof for a NOWPayments USDT payout already confirmed by IPN. */
import { createHash, randomUUID } from 'node:crypto';
import { createEvidenceRecorder } from './live-proof/evidence.mjs';
import { createRequester, parseDeploymentVersion } from './live-proof/runtime.mjs';

const PRODUCTION_HOSTS = new Set(['sophia.agencyos.network', 'www.sophia.agencyos.network']);
const evidence = createEvidenceRecorder(process.env.SOPHIA_PAYOUT_LIVE_EVIDENCE_PATH?.trim(), {
  schema: 'sophia-live-saas-payout-proof-v2',
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

function hashReference(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function parseConfig() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`Usage:
  SOPHIA_PAYOUT_LIVE_CONFIRM=verify-settled-payout \\
  SOPHIA_PAYOUT_LIVE_BASE_URL=https://staging.example.com \\
  SOPHIA_PAYOUT_LIVE_EMAIL=affiliate-test@example.com \\
  SOPHIA_PAYOUT_LIVE_PASSWORD='...' \\
  SOPHIA_PAYOUT_BATCH_ID='<confirmed USDT payout batch>' \\
  SOPHIA_PAYOUT_EXPECTED_USD=25.50 \\
  SOPHIA_VERSION_INTROSPECT_TOKEN='...' \\
  npm run verify:saas-payout:live

Optional:
  SOPHIA_PAYOUT_ALLOW_PRODUCTION=1
  SOPHIA_PAYOUT_LIVE_EVIDENCE_PATH=plans/reports/live-payout-proof.json

This command only reads an existing payout; it does not create or send one.`);
    process.exit(0);
  }

  if (required('SOPHIA_PAYOUT_LIVE_CONFIRM') !== 'verify-settled-payout') {
    fail('set SOPHIA_PAYOUT_LIVE_CONFIRM=verify-settled-payout to acknowledge this live account check');
  }

  let baseUrl;
  try {
    baseUrl = new URL(required('SOPHIA_PAYOUT_LIVE_BASE_URL'));
  } catch {
    fail('SOPHIA_PAYOUT_LIVE_BASE_URL must be an absolute URL');
  }
  const localHttp = baseUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(baseUrl.hostname);
  if (baseUrl.protocol !== 'https:' && !localHttp) fail('payout proof target must use HTTPS');
  const hostname = baseUrl.hostname.toLowerCase().replace(/\.$/, '');
  if (PRODUCTION_HOSTS.has(hostname) && process.env.SOPHIA_PAYOUT_ALLOW_PRODUCTION !== '1') {
    fail('production target requires SOPHIA_PAYOUT_ALLOW_PRODUCTION=1');
  }

  const expectedUsd = Number(required('SOPHIA_PAYOUT_EXPECTED_USD'));
  if (!Number.isFinite(expectedUsd) || expectedUsd <= 0) fail('SOPHIA_PAYOUT_EXPECTED_USD must be positive');

  return {
    baseUrl,
    email: required('SOPHIA_PAYOUT_LIVE_EMAIL'),
    password: required('SOPHIA_PAYOUT_LIVE_PASSWORD'),
    batchId: required('SOPHIA_PAYOUT_BATCH_ID'),
    expectedUsd,
  };
}

const config = parseConfig();
const runId = randomUUID();
Object.assign(evidence.context, {
  runId,
  baseUrl: config.baseUrl.origin,
  provider: 'nowpayments',
  currency: 'USDT',
  network: 'TRC20',
  expectedUsd: config.expectedUsd,
  batchRefHash: hashReference(config.batchId),
});
evidence.record('start', 'running', { runId, provider: 'nowpayments', operation: 'read-confirmed-payout' });

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

const response = await request('/api/affiliate/payouts?limit=100', { label: 'read affiliate payouts' });
if (!Array.isArray(response.batches)) fail('affiliate payouts response has no batches array');
const batch = response.batches.find((item) => item.id === config.batchId);
if (!batch) fail('requested payout batch was not found in the authenticated account payout list');
if (batch.status !== 'confirmed') fail(`payout batch is not confirmed: ${batch.status ?? 'missing'}`);
if (typeof batch.external_payment_id !== 'string' || batch.external_payment_id.length === 0 || /^mock_/i.test(batch.external_payment_id)) {
  fail('payout batch has no real provider withdrawal reference');
}
if (!String(batch.payment_method).toLowerCase().includes('usdt')) fail('payout batch payment method is not USDT');
if (String(batch.network).toUpperCase() !== 'TRC20') fail('payout batch network is not TRC20');
if (!Number.isFinite(batch.total_usd) || Math.abs(batch.total_usd - config.expectedUsd) > 0.01) {
  fail('confirmed payout amount does not match SOPHIA_PAYOUT_EXPECTED_USD');
}
if (!Number.isFinite(batch.finalized_at) || batch.finalized_at <= 0) fail('confirmed payout has no finalized timestamp');

evidence.context.payoutRefHash = hashReference(batch.external_payment_id);
evidence.context.finalizedAt = new Date(batch.finalized_at * 1000).toISOString();
evidence.record('payout-confirmed', 'passed', {
  status: batch.status,
  paymentMethod: batch.payment_method,
  network: batch.network,
  amountUsd: batch.total_usd,
  providerStatus: 'confirmed-via-signed-ipn',
  chainTransactionHashAvailable: false,
  batchRefHash: evidence.context.batchRefHash,
  payoutRefHash: evidence.context.payoutRefHash,
  finalizedAt: evidence.context.finalizedAt,
});
evidence.record('completed', 'passed', {});
evidence.write('passed', 'Existing NOWPayments USDT payout is confirmed in the authenticated Sophia account.');
console.log(`LIVE PAYOUT PROOF PASS: ${batch.total_usd.toFixed(2)} USDT, TRC20, provider-confirmed at deployment ${shortSha}.`);
console.log('This proof reads app payout state; it does not independently verify an on-chain transaction.');
