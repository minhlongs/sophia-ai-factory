#!/usr/bin/env node
/** Validate evidence emitted by verify-saas-payout-live.mjs. */
import { readFileSync } from 'node:fs';

const REQUIRED_STEPS = ['deployment-version', 'sign-in', 'payout-confirmed'];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node scripts/verify-saas-payout-live-evidence.mjs <evidence.json>');
  process.exit(0);
}

const evidencePath = process.argv[2];
if (!evidencePath) {
  console.log('Usage: node scripts/verify-saas-payout-live-evidence.mjs <evidence.json>');
  process.exit(1);
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
} catch (error) {
  fail(`could not read payout evidence: ${error instanceof Error ? error.message : String(error)}`);
}

if (evidence.schema !== 'sophia-live-saas-payout-proof-v2') fail('unexpected payout evidence schema');
if (evidence.status !== 'passed') fail(`payout evidence status is not passed: ${evidence.status ?? 'missing'}`);
if (!Array.isArray(evidence.events)) fail('payout evidence events must be an array');
if (!evidence.context || typeof evidence.context !== 'object') fail('payout evidence context is missing');

const context = evidence.context;
if (context.provider !== 'nowpayments' || context.currency !== 'USDT' || context.network !== 'TRC20') {
  fail('payout provider, currency, or network is invalid');
}
if (typeof context.runId !== 'string' || context.runId.length === 0) fail('payout runId is missing');
if (typeof context.deployment?.shortSha !== 'string' || context.deployment.shortSha.length === 0) fail('deployment SHA is missing');
if (!/^[a-f0-9]{40,64}$/i.test(context.deployment.sha ?? '')) fail('full deployment commit SHA is missing');
if (context.deployment.sha.slice(0, 8).toLowerCase() !== context.deployment.shortSha.toLowerCase()) fail('full and short deployment SHAs do not match');
if (!Number.isFinite(context.expectedUsd) || context.expectedUsd <= 0) fail('expected payout amount is invalid');
if (!/^[a-f0-9]{64}$/i.test(context.batchRefHash ?? '') || !/^[a-f0-9]{64}$/i.test(context.payoutRefHash ?? '')) {
  fail('hashed batch and provider withdrawal references are required');
}
if (!Number.isFinite(Date.parse(context.finalizedAt ?? ''))) fail('payout finalizedAt timestamp is invalid');

const events = new Map(evidence.events.map((event) => [event.step, event]));
for (const step of REQUIRED_STEPS) {
  if (events.get(step)?.status !== 'passed') fail(`required payout step not passed: ${step}`);
}
const payout = events.get('payout-confirmed')?.data;
if (payout?.status !== 'confirmed' || payout?.providerStatus !== 'confirmed-via-signed-ipn') {
  fail('payout proof does not show provider confirmation from the signed IPN path');
}
if (payout?.paymentMethod !== 'usdt_trc20' || payout?.network !== 'TRC20') fail('confirmed payout method is not USDT TRC20');
if (!Number.isFinite(payout?.amountUsd) || Math.abs(payout.amountUsd - context.expectedUsd) > 0.01) {
  fail('confirmed payout amount differs from expected amount');
}
if (payout?.batchRefHash !== context.batchRefHash || payout?.payoutRefHash !== context.payoutRefHash) {
  fail('payout references do not match context hashes');
}
if (payout?.chainTransactionHashAvailable !== false) fail('chain transaction hash availability must be reported explicitly');
if (payout?.finalizedAt !== context.finalizedAt) fail('payout finalization timestamp does not match context');

console.log(`LIVE PAYOUT EVIDENCE PASS: ${evidencePath}`);
console.log(`Deployment: ${context.deployment.shortSha}`);
console.log(`Provider/network: ${context.provider} / ${context.network}`);
console.log(`Provider-confirmed payout: ${payout.amountUsd.toFixed(2)} USDT`);
