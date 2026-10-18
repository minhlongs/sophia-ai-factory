#!/usr/bin/env node
/** Validate a private proof emitted by verify-saas-payment-live.mjs. */
import { readFileSync } from 'node:fs';

const CURRENT_SCHEMA = 'sophia-live-saas-payment-proof-v2';
const LEGACY_SCHEMA = 'sophia-live-saas-payment-proof-v1';
const REQUIRED_STEPS = ['deployment-version', 'sign-in', 'checkout-created', 'payment-completed', 'tier-activated'];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const evidencePath = process.argv[2];
if (!evidencePath || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node scripts/verify-saas-payment-live-evidence.mjs <evidence.json>');
  process.exit(evidencePath ? 0 : 1);
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
} catch (error) {
  fail(`could not read payment evidence: ${error instanceof Error ? error.message : String(error)}`);
}

if (![CURRENT_SCHEMA, LEGACY_SCHEMA].includes(evidence.schema)) fail('unexpected payment evidence schema');
if (evidence.status !== 'passed') fail(`payment evidence status is not passed: ${evidence.status ?? 'missing'}`);
if (!Array.isArray(evidence.events)) fail('payment evidence events must be an array');
if (!evidence.context || typeof evidence.context !== 'object') fail('payment evidence context is missing');

const context = evidence.context;
if (context.provider !== 'nowpayments') fail('payment provider is not NOWPayments');
if (!['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'].includes(context.tier)) fail('payment tier is invalid');
if (!['monthly', 'yearly', 'lifetime'].includes(context.period)) fail('payment period is invalid');
if (typeof context.baseUrl !== 'string' || !context.baseUrl.startsWith('https://')) fail('payment target must use HTTPS');
if (typeof context.runId !== 'string' || context.runId.length === 0) fail('payment runId is missing');
if (typeof context.deployment?.shortSha !== 'string' || context.deployment.shortSha.length === 0) fail('deployment SHA is missing');
if (evidence.schema === CURRENT_SCHEMA) {
  if (!/^[a-f0-9]{40,64}$/i.test(context.deployment.sha ?? '')) fail('full deployment commit SHA is missing');
  if (context.deployment.sha.slice(0, 8).toLowerCase() !== context.deployment.shortSha.toLowerCase()) fail('full and short deployment SHAs do not match');
}
if (!/^[a-f0-9]{64}$/i.test(context.orderRefHash ?? '')) fail('hashed order reference is missing');
if (!/^[a-f0-9]{64}$/i.test(context.paymentRefHash ?? '')) fail('hashed payment reference is missing');

const byStep = new Map(evidence.events.map((event) => [event.step, event]));
for (const step of REQUIRED_STEPS) {
  if (byStep.get(step)?.status !== 'passed') fail(`required payment step not passed: ${step}`);
}

const checkout = byStep.get('checkout-created')?.data;
if (checkout?.provider !== context.provider || checkout?.tier !== context.tier || checkout?.period !== context.period) {
  fail('checkout evidence does not match payment context');
}
if (checkout?.newOrder !== true) fail('checkout proof reused an existing order');
if (typeof checkout?.invoiceHost !== 'string' || checkout.invoiceHost.length === 0) fail('invoice host is missing');
if (checkout?.orderRefHash !== context.orderRefHash) fail('checkout order reference hash does not match context');
if (!Number.isFinite(checkout?.amountConfirmedUsd) || checkout.amountConfirmedUsd <= 0) fail('operator-confirmed invoice amount is missing');

const completed = byStep.get('payment-completed')?.data;
if (completed?.status !== 'completed' || completed?.tier !== context.tier || completed?.period !== context.period) {
  fail('completed payment does not match the requested tier and period');
}
if (completed?.paymentRefHash !== context.paymentRefHash) fail('completed payment reference hash does not match context');
if (byStep.get('tier-activated')?.data?.userTier !== context.tier) fail('activated tier does not match the paid tier');

console.log(`${evidence.schema === LEGACY_SCHEMA ? 'LEGACY ' : ''}LIVE PAYMENT EVIDENCE PASS: ${evidencePath}`);
console.log(`Deployment: ${context.deployment.shortSha}`);
if (evidence.schema === LEGACY_SCHEMA) console.log('Legacy evidence contains only a short deployment SHA.');
console.log(`Provider/tier: ${context.provider} / ${context.tier} (${context.period})`);
console.log(`Operator-confirmed invoice: $${checkout.amountConfirmedUsd.toFixed(2)} USD`);
